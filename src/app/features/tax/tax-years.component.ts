import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AppDialogService } from '../../shared/ui/dialog/dialog.service';
import { TableComponent, TableColumn } from '../../shared/ui/table/table.component';
import { TaxSearchRow, TaxService, TaxYearRow } from './tax.service';
import { normalizeYearBe, taxApiErrorText, taxErrorText } from './tax-errors';
import { DatePipe } from '@angular/common';

/**
 * หน้าแรกของโมดูลภาษี — เลือกปีภาษีที่จะทำงานด้วย
 *
 * เดิมหน้านี้อยู่รวมกับรายการไฟล์ การอัปโหลด และภาพรวมรายปีในคอมโพเนนต์เดียว
 * ปุ่ม "เปิด" จึงเปลี่ยนเนื้อหาด้านล่างโดยที่ URL ไม่ขยับ รีเฟรชแล้วหลุดกลับปีแรก
 * ตอนนี้การเลือกปีคือการเปลี่ยนหน้า จึงแชร์ลิงก์และกดย้อนกลับได้ตามปกติ
 */
@Component({
  selector: 'app-tax-years',
  imports: [TableComponent],
  providers: [DatePipe],
  templateUrl: './tax-years.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaxYearsComponent {
  private readonly taxService = inject(TaxService);
  private readonly authService = inject(AuthService);
  private readonly dialogs = inject(AppDialogService);
  private readonly router = inject(Router);
  private readonly datePipe = inject(DatePipe);

  private readonly user = toSignal(this.authService.user$, { initialValue: null });

  readonly years = signal<TaxYearRow[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  /** ตารางปีได้ข้อมูลมาครบชุด แบ่งหน้าฝั่ง client เหมือนเดิม */
  readonly page = signal(1);
  readonly pageSize = signal(10);

  readonly searchText = signal('');
  private readonly appliedSearch = signal('');

  readonly creating = signal(false);
  readonly formOpen = signal(false);
  readonly formYearBe = signal('');
  readonly formHospcode = signal('');

  // ── ค้นหาไฟล์ข้ามปี ──
  readonly fileSearchText = signal('');
  readonly fileSearchYear = signal<number | null>(null);
  readonly fileSearchHospcode = signal('');

  /**
   * เงื่อนไขของผลลัพธ์ที่กำลังแสดงอยู่ แยกจากช่องกรอกสด
   *
   * ถ้าให้การแบ่งหน้าและการโหลดซ้ำหลังลบอ่านจากช่องกรอกตรง ๆ ผู้ใช้ที่แก้คำค้น
   * ทิ้งไว้แล้วกดหน้า 2 จะได้ผลของคำค้นใหม่ปนเลขหน้าเก่า และถ้าลบคำค้นจนว่าง
   * แล้วกดลบไฟล์ จะเข้าทางที่ไม่มีเงื่อนไขแล้วค้างที่สถานะโหลด
   */
  private readonly appliedFileSearch = signal('');
  private readonly appliedFileYear = signal<number | null>(null);
  private readonly appliedFileHospcode = signal('');
  readonly fileRows = signal<TaxSearchRow[]>([]);
  readonly fileTotal = signal(0);
  readonly filePage = signal(1);
  readonly filePageSize = signal(20);
  readonly fileLoading = signal(false);
  readonly fileError = signal<string | null>(null);

  /** ค้นแล้วหรือยัง ใช้ตัดสินว่าจะโชว์ตารางผลลัพธ์ไหม ต่างจาก "ค้นแล้วไม่เจอ" */
  readonly fileSearched = signal(false);

  /** ตัวกรองปีของตารางปีภาษี กรองฝั่งหน้าเว็บเพราะข้อมูลมาครบอยู่แล้ว */
  readonly yearFilter = signal<number | null>(null);

  readonly canManage = computed(() => this.authService.hasPermission('payroll.export'));

  /**
   * หน่วยงานที่แก้ข้อมูลได้ แยกจากหน่วยงานที่เห็นได้
   *
   * ฝ่ายการเงินส่วนกลางอ่านได้ทุกหน่วยงาน แต่สร้าง ลบ และอัปโหลด
   * ยังจำกัดที่หน่วยงานของตัวเอง ถ้าไม่ซ่อนปุ่มไว้ ผู้ใช้จะกดแล้วได้ 403 เปล่า ๆ
   */
  private readonly writableHospcodes = computed(() => {
    const u = this.user();
    if (!u) return new Set<string>();
    return new Set(u.hospcodes ?? []);
  });

  private readonly canWriteAnywhere = computed(() => this.user()?.scopeType === 'ALL');

  /** เห็นข้ามหน่วยงานได้ไหม — เงื่อนไขเดียวกับฝั่ง backend */
  readonly canReadAllOffices = computed(() => {
    const u = this.user();
    if (!u) return false;
    if (u.scopeType === 'ALL') return true;
    return u.permissions.includes('finance_admin.manage') && u.roles.includes('super_admin_affairs');
  });

  /** แถวนี้แก้ได้ไหม ใช้กับทั้งตารางปีและผลค้นหา */
  canWrite(hospcode: string): boolean {
    if (!this.canManage()) return false;
    if (this.canWriteAnywhere()) return true;
    return this.writableHospcodes().has(String(hospcode));
  }

  private readonly isSuperAdmin = computed(() => this.user()?.roles?.includes('super_admin') ?? false);

  /**
   * ต้องพิมพ์รหัสหน่วยงานเองเมื่อไร
   *
   * super_admin เห็นทุกหน่วยงานจึงต้องระบุเสมอ และผู้ที่ดูแลหลายหน่วยงาน
   * ก็ต้องเลือกว่าจะสร้างให้หน่วยงานไหน ส่วนคนที่ดูแลหน่วยงานเดียว
   * ระบบเติมให้เองเหมือนเดิม
   */
  readonly requiresHospcodeInput = computed(() => {
    const u = this.user();
    if (this.isSuperAdmin()) return true;
    return u?.scopeType === 'LIST' && (u?.hospcodes?.length ?? 0) !== 1;
  });

  private readonly defaultHospcode = computed(() => {
    if (this.isSuperAdmin()) return '';
    const hospcodes = this.user()?.hospcodes ?? [];
    return hospcodes.length ? hospcodes[0] : '';
  });

  /** ปี พ.ศ. ที่มีอยู่จริง เรียงใหม่ไปเก่า ใช้เป็นตัวเลือกของทั้งสองตัวกรอง */
  readonly yearOptions = computed(() => [...new Set(this.years().map((row) => Number(row.yearBe)))].sort((a, b) => b - a));

  readonly filteredYears = computed(() => {
    const filter = this.yearFilter();
    if (filter === null) return this.years();
    return this.years().filter((row) => Number(row.yearBe) === filter);
  });

  readonly total = computed(() => this.filteredYears().length);

  readonly totalPages = computed(() => (this.total() > 0 ? Math.ceil(this.total() / this.pageSize()) : 1));

  readonly pagedYears = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.filteredYears().slice(start, start + this.pageSize());
  });

  readonly hasSearch = computed(() => this.appliedSearch().length > 0);

  readonly columns: TableColumn<TaxYearRow>[] = [
    { key: 'yearBe', header: 'ปี พ.ศ.', cell: (row) => String(row.yearBe), cellClass: 'tabular-nums' },
    { key: 'hospcode', header: 'หน่วยงาน', cell: (row) => String(row.hospcode ?? '-'), cellClass: 'font-mono' },
    {
      key: 'count',
      header: 'จำนวนไฟล์',
      cell: (row) => String(row.documentCount ?? 0),
      cellClass: 'tabular-nums text-end whitespace-nowrap'
    }
  ];

  readonly fileColumns: TableColumn<TaxSearchRow>[] = [
    { key: 'year', header: 'ปี พ.ศ.', cell: (row) => this.yearLabel(row), cellClass: 'tabular-nums' },
    { key: 'hospcode', header: 'หน่วยงาน', cell: (row) => String(row.hospcode ?? '-'), cellClass: 'font-mono' },
    { key: 'file', header: 'ชื่อไฟล์', cell: (row) => String(row.fileName ?? '-'), cellClass: 'font-mono' },
    { key: 'source', header: 'ที่มา', cell: (row) => this.sourceLabel(row.sourceType), hideOnMobile: true },
    {
      key: 'updated',
      header: 'อัปเดตล่าสุด',
      cell: (row) => this.formatDateTime(row.updatedAt),
      hideOnMobile: true
    }
  ];

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.taxService.listYears(this.appliedSearch() || undefined).subscribe({
      next: (res) => {
        this.years.set(res.data ?? []);
        if (this.page() > this.totalPages()) {
          this.page.set(this.totalPages());
        }
        this.loading.set(false);
      },
      error: (error) => {
        this.years.set([]);
        this.errorMessage.set(taxApiErrorText(error, 'LOAD_TAX_YEARS_FAILED'));
        this.loading.set(false);
      }
    });
  }

  onSearchInput(value: string): void {
    this.searchText.set(value);
  }

  onSearch(): void {
    this.clearMessages();
    this.appliedSearch.set(this.searchText().trim());
    this.page.set(1);
    this.load();
  }

  onClearSearch(): void {
    this.clearMessages();
    this.searchText.set('');
    this.appliedSearch.set('');
    this.yearFilter.set(null);
    this.page.set(1);
    this.load();
  }

  onPageChange(event: { page: number; pageSize: number }): void {
    this.page.set(event.page);
    this.pageSize.set(event.pageSize);
  }

  openYear(year: TaxYearRow): void {
    void this.router.navigate(['/tax', year.id, 'documents']);
  }

  openUpload(year: TaxYearRow): void {
    void this.router.navigate(['/tax', year.id, 'upload']);
  }

  toggleForm(): void {
    const next = !this.formOpen();
    this.formOpen.set(next);
    if (next) {
      this.clearMessages();
      this.formHospcode.set(this.defaultHospcode());
    }
  }

  onFormYearBeInput(value: string): void {
    this.formYearBe.set(value);
  }

  onFormHospcodeInput(value: string): void {
    this.formHospcode.set(value);
  }

  /** ปี พ.ศ. ที่จะได้จริงจากที่พิมพ์อยู่ ช่วยยืนยันว่าพิมพ์ 68 แล้วได้ 2568 */
  readonly formYearPreview = computed(() => normalizeYearBe(this.formYearBe()));

  createYear(): void {
    this.clearMessages();

    const yearBe = normalizeYearBe(this.formYearBe());
    if (yearBe === null) {
      this.errorMessage.set(taxErrorText('INVALID_YEAR_BE'));
      return;
    }

    this.creating.set(true);
    this.taxService
      .createYear({ yearBe, hospcode: this.formHospcode().trim() || undefined })
      .subscribe({
        next: (res) => {
          this.creating.set(false);
          this.formYearBe.set('');
          this.formHospcode.set(this.defaultHospcode());
          this.formOpen.set(false);

          const createdId = Number(res?.data?.id ?? 0);
          if (Number.isInteger(createdId) && createdId > 0) {
            // ปีที่เพิ่งสร้างยังไม่มีไฟล์ พาไปหน้าอัปโหลดซึ่งเป็นงานถัดไปแน่นอน
            void this.router.navigate(['/tax', createdId, 'upload']);
            return;
          }

          this.successMessage.set(`เพิ่มปี พ.ศ. ${yearBe} สำเร็จ`);
          this.load();
        },
        error: (error) => {
          this.creating.set(false);
          this.errorMessage.set(taxApiErrorText(error, 'CREATE_TAX_YEAR_FAILED'));
        }
      });
  }

  deleteYear(year: TaxYearRow): void {
    this.clearMessages();

    this.dialogs
      .confirm({
        title: 'ยืนยันลบปีภาษี',
        message: `ปี พ.ศ. ${year.yearBe} ของหน่วยงาน ${year.hospcode}`,
        consequences: [
          `ลบรายการไฟล์ในปีนี้ทั้งหมด ${year.documentCount} รายการ`,
          'ผู้ที่มีไฟล์อยู่ในปีนี้จะดาวน์โหลดผ่านระบบไม่ได้อีก'
        ],
        warning: 'มีระบบภายนอกดึงไฟล์ภาษีผ่าน endpoint ภายในอยู่ การลบกระทบระบบนั้นด้วย',
        confirmLabel: 'ลบปีภาษี',
        danger: true
      })
      .pipe(filter(Boolean))
      .subscribe(() => this.runDeleteYear(year));
  }

  private runDeleteYear(year: TaxYearRow): void {
    this.loading.set(true);
    this.taxService.deleteYear(year.id).subscribe({
      next: (res) => {
        const failed = res.data?.filesFailed ?? 0;
        // ลบข้อมูลสำเร็จเสมอถ้ามาถึงตรงนี้ แต่ไฟล์บนดิสก์อาจลบไม่ครบ
        // ต้องบอกผู้ใช้ ไม่งั้นไฟล์ค้างจะสะสมโดยไม่มีใครรู้ (TAX-16)
        this.successMessage.set(
          failed > 0
            ? `ลบปี พ.ศ. ${year.yearBe} สำเร็จ แต่ลบไฟล์บนเซิร์ฟเวอร์ไม่สำเร็จ ${failed} ไฟล์ กรุณาแจ้งผู้ดูแลระบบ`
            : `ลบปี พ.ศ. ${year.yearBe} สำเร็จ`
        );
        this.load();
      },
      error: (error) => {
        this.loading.set(false);
        this.errorMessage.set(taxApiErrorText(error, 'DELETE_TAX_YEAR_FAILED'));
      }
    });
  }

  // ── ค้นหาไฟล์ข้ามปี ──────────────────────────────────────

  onFileSearchInput(value: string): void {
    this.fileSearchText.set(value);
  }

  onFileSearchYearChange(value: string): void {
    this.fileSearchYear.set(value ? Number(value) : null);
  }

  onFileSearchHospcodeInput(value: string): void {
    this.fileSearchHospcode.set(value);
  }

  /**
   * ช่องกรองหน่วยงานของการค้นไฟล์
   *
   * มีประโยชน์เฉพาะคนที่เห็นได้มากกว่าหนึ่งหน่วยงาน ผู้ดูแลหน่วยงานเดียว
   * กรองไปก็ได้ผลเท่าเดิม จึงซ่อนไว้ให้หน้าสะอาด
   */
  readonly showFileHospcodeFilter = computed(() => {
    if (this.canReadAllOffices()) return true;
    return (this.user()?.hospcodes?.length ?? 0) > 1;
  });

  onFileSearch(): void {
    this.clearMessages();
    this.fileError.set(null);

    const search = this.fileSearchText().trim();
    const yearBe = this.fileSearchYear();
    const hospcode = this.fileSearchHospcode().trim();
    if (!search && yearBe === null && !hospcode) {
      this.fileError.set('กรุณาใส่คำค้น เลือกปี หรือระบุหน่วยงาน อย่างน้อยหนึ่งอย่าง');
      return;
    }

    this.appliedFileSearch.set(search);
    this.appliedFileYear.set(yearBe);
    this.appliedFileHospcode.set(hospcode);
    this.filePage.set(1);
    this.runFileSearch();
  }

  onClearFileSearch(): void {
    this.fileSearchText.set('');
    this.fileSearchYear.set(null);
    this.fileSearchHospcode.set('');
    this.appliedFileSearch.set('');
    this.appliedFileYear.set(null);
    this.appliedFileHospcode.set('');
    this.fileRows.set([]);
    this.fileTotal.set(0);
    this.filePage.set(1);
    this.fileSearched.set(false);
    this.fileError.set(null);
  }

  onFilePageChange(event: { page: number; pageSize: number }): void {
    this.filePage.set(event.page);
    this.filePageSize.set(event.pageSize);
    this.runFileSearch();
  }

  /** ต้องมีคำค้นหรือปีอย่างน้อยหนึ่งอย่าง ตรงกับที่ backend บังคับ */
  readonly fileSearchReady = computed(
    () => !!this.fileSearchText().trim() || this.fileSearchYear() !== null || !!this.fileSearchHospcode().trim()
  );

  private runFileSearch(): void {
    const search = this.appliedFileSearch();
    const yearBe = this.appliedFileYear();
    const hospcode = this.appliedFileHospcode();

    // กันไว้อีกชั้น ถ้าเข้ามาโดยไม่มีเงื่อนไขต้องไม่ทิ้งสถานะโหลดค้างไว้
    if (!search && yearBe === null && !hospcode) {
      this.fileLoading.set(false);
      return;
    }

    this.fileLoading.set(true);
    this.fileError.set(null);

    this.taxService
      .searchDocuments({
        search: search || undefined,
        yearBe: yearBe ?? undefined,
        hospcode: hospcode || undefined,
        page: this.filePage(),
        pageSize: this.filePageSize()
      })
      .subscribe({
        next: (res) => {
          const rows = res.data?.rows ?? [];
          const total = Number(res.data?.total ?? 0);

          // ลบไฟล์สุดท้ายของหน้าท้าย ๆ แล้วหน้านี้จะว่างทั้งที่ยังมีผลอยู่
          if (!rows.length && total > 0 && this.filePage() > 1) {
            this.filePage.update((p) => p - 1);
            this.runFileSearch();
            return;
          }

          this.fileRows.set(rows);
          this.fileTotal.set(total);
          this.fileSearched.set(true);
          this.fileLoading.set(false);
        },
        error: (error) => {
          this.fileRows.set([]);
          this.fileTotal.set(0);
          this.fileSearched.set(true);
          this.fileError.set(taxApiErrorText(error, 'LOAD_TAX_DOCUMENTS_FAILED'));
          this.fileLoading.set(false);
        }
      });
  }

  /** ไปหน้าไฟล์ของปีที่แถวนั้นอยู่ เพื่อทำงานต่อในบริบทของปีนั้น */
  openYearOfRow(row: TaxSearchRow): void {
    void this.router.navigate(['/tax', row.taxYearId, 'documents']);
  }

  openFile(row: TaxSearchRow): void {
    this.fileError.set(null);
    this.taxService.downloadDocument(row.id).subscribe({
      next: (response) => {
        const blob = response.body;
        if (!blob) {
          this.fileError.set(taxErrorText('EMPTY_DOWNLOAD_FILE'));
          return;
        }

        const pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
        const url = URL.createObjectURL(pdfBlob);
        const openedWindow = window.open(url, '_blank', 'noopener,noreferrer');
        if (!openedWindow) {
          this.fileError.set(taxErrorText('OPEN_PREVIEW_POPUP_BLOCKED'));
          URL.revokeObjectURL(url);
          return;
        }

        window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      },
      error: (error) => this.fileError.set(taxApiErrorText(error, 'DOWNLOAD_TAX_FILE_FAILED'))
    });
  }

  deleteFile(row: TaxSearchRow): void {
    this.clearMessages();
    this.fileError.set(null);

    this.dialogs
      .confirm({
        title: 'ยืนยันลบไฟล์',
        // ผลค้นหาข้ามปี จึงต้องบอกปีกับหน่วยงานให้ชัด ไม่ใช่แค่ชื่อไฟล์
        message: `${row.fileName} — ปี ${row.yearBe} หน่วยงาน ${row.hospcode}`,
        consequences: [
          'ลบรายการออกจากระบบและลบไฟล์ออกจากที่จัดเก็บ',
          'เจ้าของเอกสารจะดาวน์โหลดไฟล์นี้ไม่ได้อีก'
        ],
        warning: 'มีระบบภายนอกดึงไฟล์ภาษีผ่าน endpoint ภายในอยู่ การลบกระทบระบบนั้นด้วย',
        confirmLabel: 'ลบไฟล์',
        danger: true
      })
      .pipe(filter(Boolean))
      .subscribe(() => this.runDeleteFile(row));
  }

  private runDeleteFile(row: TaxSearchRow): void {
    this.fileLoading.set(true);
    this.taxService.deleteDocument(row.id).subscribe({
      next: () => {
        this.successMessage.set(`ลบไฟล์ ${row.fileName} เรียบร้อยแล้ว`);
        this.runFileSearch();
        // จำนวนไฟล์ในตารางปีเปลี่ยนด้วย
        this.load();
      },
      error: (error) => {
        this.fileLoading.set(false);
        this.fileError.set(taxApiErrorText(error, 'DELETE_TAX_DOCUMENT_FAILED'));
      }
    });
  }

  // ── ตัวกรองปีของตารางปีภาษี ──────────────────────────────

  onYearFilterChange(value: string): void {
    this.yearFilter.set(value ? Number(value) : null);
    this.page.set(1);
  }

  /**
   * ปีของแถว พร้อมเตือนเมื่อเอกสารบันทึกปีไว้ไม่ตรงกับแถวปีภาษี
   *
   * มีข้อมูลจริง 1,228 แถวที่ไม่ตรง ชื่อไฟล์กับโฟลเดอร์ก็อิงปีเก่า
   * ถ้าไม่บอกไว้ ผู้ใช้จะเห็น "ปี 2568" คู่กับไฟล์ชื่อ 00_... แล้วสับสน
   */
  private yearLabel(row: TaxSearchRow): string {
    if (Number(row.documentYearBe) !== Number(row.yearBe)) {
      return `${row.yearBe} (ไฟล์ระบุ ${row.documentYearBe})`;
    }
    return String(row.yearBe);
  }

  private sourceLabel(sourceType: string): string {
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
