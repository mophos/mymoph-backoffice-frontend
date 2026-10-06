import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { filter } from 'rxjs';
import { AppDialogService } from '../../shared/ui/dialog/dialog.service';
import { TableComponent, TableColumn } from '../../shared/ui/table/table.component';
import { TaxDocumentRow, TaxService } from './tax.service';
import { TaxYearStore } from './tax-year.store';
import { taxApiErrorText, taxErrorText } from './tax-errors';

/**
 * ไฟล์ทั้งหมดในปีภาษีที่เปิดอยู่ — ค้นหา เปิดดู และลบ
 *
 * แยกออกจากหน้าอัปโหลดแล้ว เพราะสองงานนี้ไม่เกี่ยวกัน
 * เดิมอยู่แท็บเดียวกันทำให้ปุ่มค้นหากับปุ่มอัปโหลดอยู่ในหน้าจอเดียว
 * และการกดค้นหาเคยสลับแท็บกลับมาเองโดยที่ผู้ใช้ไม่ได้สั่ง
 */
@Component({
  selector: 'app-tax-documents',
  imports: [TableComponent],
  providers: [DatePipe],
  templateUrl: './tax-documents.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaxDocumentsComponent {
  private readonly taxService = inject(TaxService);
  private readonly dialogs = inject(AppDialogService);
  private readonly datePipe = inject(DatePipe);

  private readonly store = inject(TaxYearStore);

  readonly rows = signal<TaxDocumentRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly searchText = signal('');
  private readonly appliedSearch = signal('');

  /** ปุ่มลบขึ้นเมื่อแก้ปีนี้ได้จริง ฝ่ายการเงินที่เปิดดูปีหน่วยงานอื่นจะไม่เห็นปุ่ม */
  readonly canManage = computed(() => this.store.canWriteSelectedYear());
  readonly hasSearch = computed(() => this.appliedSearch().length > 0);

  /** ไล่หน้าทีละหน้ากับหลายพันไฟล์ช้ากว่าค้นด้วยเลขบัตรมาก จึงบอกไว้เมื่อข้อมูลเยอะ */
  readonly suggestSearch = computed(() => !this.hasSearch() && this.total() > this.pageSize());

  readonly columns: TableColumn<TaxDocumentRow>[] = [
    { key: 'file', header: 'ชื่อไฟล์', cell: (row) => String(row.file_name ?? '-'), cellClass: 'font-mono' },
    { key: 'type', header: 'ที่มา', cell: (row) => this.sourceLabel(row.source_type), hideOnMobile: true },
    {
      key: 'updated',
      header: 'อัปเดตล่าสุด',
      cell: (row) => this.formatDateTime(row.updated_at),
      hideOnMobile: true
    }
  ];

  constructor() {
    /*
     * ปีเปลี่ยนเมื่อไร (รวมตอนเข้าหน้าครั้งแรก) ให้โหลดไฟล์ของปีนั้นใหม่
     *
     * ต้องหุ้ม load() ด้วย untracked ไม่งั้น effect จะไปติดตาม page, pageSize
     * และคำค้นที่ load() อ่าน แล้วโหลดซ้ำทุกครั้งที่ค่าเหล่านั้นขยับ
     * ซึ่งซ้อนกับการเรียก reload() ที่ตัวจัดการเหตุการณ์ทำอยู่แล้ว
     */
    effect(() => {
      const yearId = this.store.yearId();

      untracked(() => {
        if (yearId === null) {
          this.rows.set([]);
          this.total.set(0);
          return;
        }

        this.load(yearId);
      });
    });
  }

  private load(yearId: number): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.taxService
      .listDocuments({
        yearId,
        search: this.appliedSearch() || undefined,
        page: this.page(),
        pageSize: this.pageSize()
      })
      .subscribe({
        next: (res) => {
          const rows = res.data?.rows ?? [];
          const total = Number(res.data?.total ?? 0);

          // ลบไฟล์สุดท้ายของหน้าท้าย ๆ แล้วหน้านี้จะว่างทั้งที่ยังมีข้อมูลอยู่
          if (!rows.length && total > 0 && this.page() > 1) {
            this.page.update((p) => p - 1);
            this.load(yearId);
            return;
          }

          this.rows.set(rows);
          this.total.set(total);
          this.loading.set(false);
        },
        error: (error) => {
          this.rows.set([]);
          this.total.set(0);
          this.errorMessage.set(taxApiErrorText(error, 'LOAD_TAX_DOCUMENTS_FAILED'));
          this.loading.set(false);
        }
      });
  }

  private reload(): void {
    const yearId = this.store.yearId();
    if (yearId === null) return;
    this.load(yearId);
  }

  onSearchInput(value: string): void {
    this.searchText.set(value);
  }

  onSearch(): void {
    this.clearMessages();
    this.appliedSearch.set(this.searchText().trim());
    this.page.set(1);
    this.reload();
  }

  onClearSearch(): void {
    this.clearMessages();
    this.searchText.set('');
    this.appliedSearch.set('');
    this.page.set(1);
    this.reload();
  }

  onPageChange(event: { page: number; pageSize: number }): void {
    this.page.set(event.page);
    this.pageSize.set(event.pageSize);
    this.reload();
  }

  /**
   * เปิดไฟล์ในแท็บใหม่
   *
   * backend ส่งไฟล์เป็น blob ที่ต้องมี Authorization header จึงโหลดมาก่อน
   * แล้วค่อยเปิดจาก object URL ไม่สามารถชี้ <a href> ไปที่ endpoint ตรง ๆ ได้
   */
  openDocument(row: TaxDocumentRow): void {
    this.clearMessages();
    this.taxService.downloadDocument(row.id).subscribe({
      next: (response) => {
        const blob = response.body;
        if (!blob) {
          this.errorMessage.set(taxErrorText('EMPTY_DOWNLOAD_FILE'));
          return;
        }

        const pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
        const url = URL.createObjectURL(pdfBlob);
        const openedWindow = window.open(url, '_blank', 'noopener,noreferrer');
        if (!openedWindow) {
          this.errorMessage.set(taxErrorText('OPEN_PREVIEW_POPUP_BLOCKED'));
          URL.revokeObjectURL(url);
          return;
        }

        window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      },
      error: (error) => this.errorMessage.set(taxApiErrorText(error, 'DOWNLOAD_TAX_FILE_FAILED'))
    });
  }

  deleteDocument(row: TaxDocumentRow): void {
    this.clearMessages();

    this.dialogs
      .confirm({
        title: 'ยืนยันลบไฟล์',
        message: row.file_name,
        consequences: [
          'ลบรายการออกจากระบบและลบไฟล์ออกจากที่จัดเก็บ',
          'เจ้าของเอกสารจะดาวน์โหลดไฟล์นี้ไม่ได้อีก'
        ],
        warning: 'มีระบบภายนอกดึงไฟล์ภาษีผ่าน endpoint ภายในอยู่ การลบกระทบระบบนั้นด้วย',
        confirmLabel: 'ลบไฟล์',
        danger: true
      })
      .pipe(filter(Boolean))
      .subscribe(() => this.runDelete(row));
  }

  private runDelete(row: TaxDocumentRow): void {
    this.loading.set(true);
    this.taxService.deleteDocument(row.id).subscribe({
      next: () => {
        this.successMessage.set(`ลบไฟล์ ${row.file_name} เรียบร้อยแล้ว`);
        this.reload();
        // จำนวนไฟล์ที่หัวข้อด้านบนมาจาก store ต้องให้มันรู้ว่าลดลงแล้ว
        this.store.reload();
      },
      error: (error) => {
        this.loading.set(false);
        this.errorMessage.set(taxApiErrorText(error, 'DELETE_TAX_DOCUMENT_FAILED'));
      }
    });
  }

  private sourceLabel(sourceType: TaxDocumentRow['source_type']): string {
    if (sourceType === 'batch') return 'อัปโหลดแบบเป็นชุด';
    if (sourceType === 'single') return 'อัปโหลดรายบุคคล';
    return '-';
  }

  private formatDateTime(value: string | null | undefined): string {
    if (!value) return '-';
    return this.datePipe.transform(value, 'dd MMM yyyy HH:mm', 'Asia/Bangkok', 'th-TH') ?? '-';
  }

  private clearMessages(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }
}
