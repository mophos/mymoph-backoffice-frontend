import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { PDFDocument } from 'pdf-lib';
import { TableComponent, TableColumn } from '../../shared/ui/table/table.component';
import { BatchUploadPreviewRow, IndividualUploadPreviewRow, TaxService } from './tax.service';
import { TaxYearStore } from './tax-year.store';
import { isPdfFile, isTxtFile, taxApiErrorText, taxErrorText } from './tax-errors';

type UploadMode = 'batch' | 'individual';

interface IndividualRow {
  /**
   * id คงที่ต่อแถว ใช้เป็น track ของ @for
   *
   * ถ้า track ด้วย $index การลบแถวกลางจะทำให้ Angular เอา DOM เดิมมาใช้ซ้ำ
   * ช่อง <input type="file"> ไม่มี binding จึงยังโชว์ชื่อไฟล์ของแถวที่ถูกลบ
   * ขณะที่ค่าที่จะอัปโหลดเป็นของอีกแถว
   *
   * ถ้า track ด้วยตัว object ก็ไม่ได้ เพราะการพิมพ์เลขบัตรสร้าง object ใหม่ทุกครั้ง
   * Angular จะสร้าง DOM ใหม่และไฟล์ที่เลือกไว้หลุดหายทุกตัวอักษรที่พิมพ์
   */
  id: number;
  cid: string;
  file: File | null;
}

interface IndividualPreviewItem extends IndividualUploadPreviewRow {
  file: File;
  previewUrl: string;
}

/**
 * อัปโหลดไฟล์เข้าปีภาษีที่เปิดอยู่
 *
 * เดิมสองวิธีอัปโหลดวางซ้อนกันในหน้าเดียวกับรายการไฟล์ และมีปุ่ม
 * "ตรวจสอบก่อนบันทึก" สองปุ่มที่หน้าตาเหมือนกันแต่ทำงานกับคนละชุดไฟล์
 * ตอนนี้เลือกวิธีก่อนหนึ่งครั้ง แล้วเหลือปุ่มเดียวในแต่ละขั้น
 *
 * ขั้นตอนยังเหมือนเดิมทุกอย่างคือ เลือกไฟล์ → ตรวจสอบ → ยืนยันบันทึกจริง
 * และการตรวจสอบไม่เขียนข้อมูลใด ๆ ลงฐาน
 */
@Component({
  selector: 'app-tax-upload',
  imports: [TableComponent],
  templateUrl: './tax-upload.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaxUploadComponent {
  private readonly taxService = inject(TaxService);
  readonly store = inject(TaxYearStore);

  private readonly batchPdfInput = viewChild<ElementRef<HTMLInputElement>>('batchPdfInput');
  private readonly batchTxtInput = viewChild<ElementRef<HTMLInputElement>>('batchTxtInput');

  readonly mode = signal<UploadMode>('batch');

  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly batchPdfFile = signal<File | null>(null);
  readonly batchTxtFile = signal<File | null>(null);

  private nextRowId = 1;

  readonly individualRows = signal<IndividualRow[]>([{ id: 0, cid: '', file: null }]);

  readonly previewLoading = signal(false);
  readonly confirming = signal(false);

  /** วิธีที่ตัวอย่างชุดปัจจุบันมาจาก null = ยังไม่ได้ตรวจสอบ */
  readonly previewMode = signal<UploadMode | null>(null);

  readonly batchPreviewRows = signal<BatchUploadPreviewRow[]>([]);
  readonly batchPreviewPageCount = signal(0);
  readonly batchPreviewLineCount = signal(0);
  readonly batchPreviewDelimiter = signal('');
  readonly batchPreviewPage = signal(1);
  readonly batchPreviewPageSize = signal(10);

  readonly individualPreviewItems = signal<IndividualPreviewItem[]>([]);
  readonly individualPreviewPage = signal(1);
  readonly individualPreviewPageSize = signal(10);
  private individualPreparedItems: Array<{ cid: string; file: File }> = [];

  /** PDF ต้นฉบับที่ถอดไว้แล้ว ใช้ตัดหน้าเดียวให้ดูตัวอย่างโดยไม่อ่านไฟล์ซ้ำ */
  private batchPreviewPdf: PDFDocument | null = null;

  readonly uploadResult = signal<{ count: number; mode: UploadMode } | null>(null);

  /**
   * แก้ปีนี้ได้ไหม
   *
   * แถบอัปโหลดถูกซ่อนไว้แล้วเมื่อแก้ไม่ได้ แต่ผู้ใช้พิมพ์ URL เข้ามาตรง ๆ ได้
   * route guard ตรวจได้แค่ permission ไม่รู้ว่าปีในลิงก์เป็นของหน่วยงานไหน
   * จึงต้องกันที่หน้านี้อีกชั้น ไม่ใช่ปล่อยให้กดแล้วได้ 403 จาก API
   */
  readonly canUpload = computed(() => this.store.canWriteSelectedYear());

  readonly blockedBecauseOtherOffice = computed(() => this.store.readOnlyBecauseOtherOffice());

  readonly yearBe = computed(() => this.store.year()?.yearBe ?? null);
  readonly yearShortLabel = computed(() => this.store.yearShortLabel());

  readonly busy = computed(() => this.previewLoading() || this.confirming());

  readonly batchReady = computed(() => !!this.batchPdfFile() && !!this.batchTxtFile());

  /** แถวที่กรอกอะไรไว้แล้ว ใช้บอกจำนวนบนปุ่มให้เห็นว่าจะตรวจกี่รายการ */
  readonly individualFilledCount = computed(
    () => this.individualRows().filter((row) => row.cid.trim() || row.file).length
  );

  readonly individualPreviewTotal = computed(() => this.individualPreviewItems().length);

  readonly pagedIndividualPreview = computed(() => {
    const start = (this.individualPreviewPage() - 1) * this.individualPreviewPageSize();
    return this.individualPreviewItems().slice(start, start + this.individualPreviewPageSize());
  });

  readonly batchPreviewTotal = computed(() => this.batchPreviewRows().length);

  readonly pagedBatchPreview = computed(() => {
    const start = (this.batchPreviewPage() - 1) * this.batchPreviewPageSize();
    return this.batchPreviewRows().slice(start, start + this.batchPreviewPageSize());
  });

  readonly individualPreviewColumns: TableColumn<IndividualPreviewItem>[] = [
    { key: 'cid', header: 'เลขบัตรประชาชน', cell: (row) => String(row.cid ?? '-'), cellClass: 'font-mono tabular-nums' },
    { key: 'new', header: 'ชื่อไฟล์ใหม่', cell: (row) => String(row.fileName ?? '-'), cellClass: 'font-mono' },
    { key: 'origin', header: 'ไฟล์ต้นฉบับ', cell: (row) => String(row.originalFileName ?? '-'), hideOnMobile: true }
  ];

  readonly batchPreviewColumns: TableColumn<BatchUploadPreviewRow>[] = [
    {
      key: 'page',
      header: 'หน้า PDF',
      cell: (row) => String(row.pageNo),
      cellClass: 'tabular-nums text-end whitespace-nowrap'
    },
    { key: 'cid', header: 'เลขบัตรประชาชน', cell: (row) => String(row.cid ?? '-'), cellClass: 'font-mono tabular-nums' },
    { key: 'fileNo', header: 'ไฟล์ที่', cell: (row) => String(row.fileNo), cellClass: 'tabular-nums text-end whitespace-nowrap' },
    { key: 'new', header: 'ชื่อไฟล์ใหม่', cell: (row) => String(row.fileName ?? '-'), cellClass: 'font-mono' }
  ];

  constructor() {
    // object URL ของตัวอย่างรายบุคคลต้องถูกคืนเสมอ ไม่งั้นไฟล์ค้างในหน่วยความจำ
    inject(DestroyRef).onDestroy(() => this.revokeIndividualPreviewUrls());
  }

  setMode(mode: UploadMode): void {
    if (this.mode() === mode) return;
    this.mode.set(mode);
    this.clearPreview();
    this.clearMessages();
    this.uploadResult.set(null);
  }

  // ── แบบเป็นชุด ──────────────────────────────────────────────

  onBatchPdfChange(event: Event): void {
    this.clearPreview();
    const input = event.target as HTMLInputElement;
    this.batchPdfFile.set(input.files?.[0] ?? null);
  }

  onBatchTxtChange(event: Event): void {
    this.clearPreview();
    const input = event.target as HTMLInputElement;
    this.batchTxtFile.set(input.files?.[0] ?? null);
  }

  previewBatch(): void {
    this.clearMessages();
    this.uploadResult.set(null);

    const yearId = this.store.yearId();
    if (yearId === null) return;

    const pdf = this.batchPdfFile();
    const txt = this.batchTxtFile();

    if (!pdf || !txt) {
      this.errorMessage.set(taxErrorText('PDF_AND_TXT_REQUIRED'));
      return;
    }

    if (!isPdfFile(pdf)) {
      this.errorMessage.set(taxErrorText('ONLY_PDF_ALLOWED'));
      return;
    }

    if (!isTxtFile(txt)) {
      this.errorMessage.set(taxErrorText('INVALID_TXT_FILE'));
      return;
    }

    this.previewLoading.set(true);
    this.taxService.previewUploadBatch(yearId, pdf, txt).subscribe({
      next: (res) => {
        this.clearPreview();
        this.batchPreviewRows.set(Array.isArray(res.data?.rows) ? res.data.rows : []);
        this.batchPreviewPageCount.set(Number(res.data?.pageCount || 0));
        this.batchPreviewLineCount.set(Number(res.data?.lineCount || 0));
        this.batchPreviewDelimiter.set(String(res.data?.delimiter || ''));
        this.batchPreviewPage.set(1);
        this.previewMode.set('batch');
        this.previewLoading.set(false);
      },
      error: (error) => {
        this.previewLoading.set(false);
        this.errorMessage.set(taxApiErrorText(error, 'PREVIEW_BATCH_FAILED'));
      }
    });
  }

  /** ตัดหน้าที่เลือกออกมาเป็น PDF หน้าเดียวให้ดูก่อนบันทึก ทำทั้งหมดในเบราว์เซอร์ */
  openBatchSplitPreview(row: BatchUploadPreviewRow): void {
    void this.openBatchSplitPreviewAsync(row);
  }

  private async openBatchSplitPreviewAsync(row: BatchUploadPreviewRow): Promise<void> {
    const pdf = this.batchPdfFile();
    if (!pdf) {
      this.errorMessage.set(taxErrorText('PDF_AND_TXT_REQUIRED'));
      return;
    }

    const sourcePdf = await this.getBatchPreviewPdf(pdf);
    if (!sourcePdf) {
      this.errorMessage.set(taxErrorText('INVALID_PDF_FILE'));
      return;
    }

    const pageIndex = Number(row.pageNo) - 1;
    if (pageIndex < 0 || pageIndex >= sourcePdf.getPageCount()) {
      this.errorMessage.set(taxErrorText('INVALID_PREVIEW_PAGE'));
      return;
    }

    const pagePdf = await PDFDocument.create();
    const [copiedPage] = await pagePdf.copyPages(sourcePdf, [pageIndex]);
    pagePdf.addPage(copiedPage);
    const pageBytes = await pagePdf.save();
    // TypeScript 5.9 ทำให้ Uint8Array เป็น generic: สำเนาเพื่อยืนยันว่า buffer เป็น ArrayBuffer ไม่ใช่ SharedArrayBuffer
    const blob = new Blob([new Uint8Array(pageBytes)], { type: 'application/pdf' });
    this.openInNewTab(URL.createObjectURL(blob), true);
  }

  private async getBatchPreviewPdf(file: File): Promise<PDFDocument | null> {
    if (this.batchPreviewPdf) return this.batchPreviewPdf;

    try {
      this.batchPreviewPdf = await PDFDocument.load(await file.arrayBuffer());
      return this.batchPreviewPdf;
    } catch {
      return null;
    }
  }

  // ── รายบุคคล ────────────────────────────────────────────────

  addIndividualRow(): void {
    this.clearPreview();
    this.individualRows.update((rows) => [...rows, { id: this.nextRowId++, cid: '', file: null }]);
  }

  removeIndividualRow(index: number): void {
    this.clearPreview();
    if (this.individualRows().length <= 1) return;
    this.individualRows.update((rows) => rows.filter((_, i) => i !== index));
  }

  onIndividualCidInput(index: number, value: string): void {
    this.clearPreview();
    this.individualRows.update((rows) => rows.map((row, i) => (i === index ? { ...row, cid: value } : row)));
  }

  onIndividualFileChange(event: Event, index: number): void {
    this.clearPreview();
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.individualRows.update((rows) => rows.map((row, i) => (i === index ? { ...row, file } : row)));
  }

  previewIndividual(): void {
    this.clearMessages();
    this.uploadResult.set(null);

    const yearId = this.store.yearId();
    if (yearId === null) return;

    const items = this.individualRows()
      .filter((row) => row.cid.trim() || row.file)
      .map((row) => ({ cid: row.cid.trim(), file: row.file }));

    if (!items.length) {
      this.errorMessage.set(taxErrorText('NO_UPLOAD_ITEMS'));
      return;
    }

    if (items.some((item) => !item.cid || !item.file)) {
      this.errorMessage.set(taxErrorText('CID_OR_FILE_MISSING'));
      return;
    }

    if (items.some((item) => !item.file!.name.toLowerCase().endsWith('.pdf'))) {
      this.errorMessage.set(taxErrorText('ONLY_PDF_ALLOWED'));
      return;
    }

    const preparedItems = items.map((item) => ({ cid: item.cid, file: item.file! }));

    this.previewLoading.set(true);
    this.taxService.previewUploadIndividual(yearId, preparedItems).subscribe({
      next: (res) => {
        this.clearPreview();
        const previewRows = Array.isArray(res.data?.rows) ? res.data.rows : [];

        // จำนวนที่ตอบกลับต้องตรงกับที่ส่งไป ไม่งั้นจับคู่ไฟล์กับชื่อใหม่ผิดคน
        if (previewRows.length !== preparedItems.length) {
          this.previewLoading.set(false);
          this.errorMessage.set(taxErrorText('PREVIEW_RESPONSE_MISMATCH'));
          return;
        }

        this.individualPreparedItems = preparedItems;
        this.individualPreviewItems.set(
          previewRows.map((row, index) => ({
            ...row,
            file: preparedItems[index].file,
            previewUrl: URL.createObjectURL(preparedItems[index].file)
          }))
        );
        this.individualPreviewPage.set(1);
        this.previewMode.set('individual');
        this.previewLoading.set(false);
      },
      error: (error) => {
        this.previewLoading.set(false);
        this.errorMessage.set(taxApiErrorText(error, 'PREVIEW_INDIVIDUAL_FAILED'));
      }
    });
  }

  openIndividualPreview(item: IndividualPreviewItem): void {
    this.openInNewTab(item.previewUrl, false);
  }

  // ── ยืนยันบันทึกจริง ────────────────────────────────────────

  confirmUpload(): void {
    const yearId = this.store.yearId();
    if (yearId === null) return;

    const mode = this.previewMode();
    if (!mode) {
      this.errorMessage.set(taxErrorText('NO_PREVIEW_TO_CONFIRM'));
      return;
    }

    this.clearMessages();
    this.confirming.set(true);

    if (mode === 'individual') {
      if (!this.individualPreparedItems.length) {
        this.confirming.set(false);
        this.errorMessage.set(taxErrorText('NO_PREVIEW_TO_CONFIRM'));
        return;
      }

      this.taxService.uploadIndividual(yearId, this.individualPreparedItems).subscribe({
        next: (res) => {
          this.confirming.set(false);
          this.uploadResult.set({ count: Number(res.data?.createdCount ?? 0), mode: 'individual' });
          // id ใหม่บังคับให้ Angular สร้างช่องไฟล์ใหม่ ค่าใน DOM จึงถูกล้างจริง
          this.individualRows.set([{ id: this.nextRowId++, cid: '', file: null }]);
          this.clearPreview();
          this.store.reload();
        },
        error: (error) => {
          this.confirming.set(false);
          this.errorMessage.set(taxApiErrorText(error, 'UPLOAD_INDIVIDUAL_FAILED'));
        }
      });
      return;
    }

    const pdf = this.batchPdfFile();
    const txt = this.batchTxtFile();
    if (!pdf || !txt || !this.batchPreviewRows().length) {
      this.confirming.set(false);
      this.errorMessage.set(taxErrorText('NO_PREVIEW_TO_CONFIRM'));
      return;
    }

    this.taxService.uploadBatch(yearId, pdf, txt).subscribe({
      next: (res) => {
        this.confirming.set(false);
        this.uploadResult.set({ count: Number(res.data?.createdCount ?? 0), mode: 'batch' });
        this.batchPdfFile.set(null);
        this.batchTxtFile.set(null);
        this.resetBatchFileInputs();
        this.clearPreview();
        this.store.reload();
      },
      error: (error) => {
        this.confirming.set(false);
        this.errorMessage.set(taxApiErrorText(error, 'UPLOAD_BATCH_FAILED'));
      }
    });
  }

  cancelPreview(): void {
    this.clearPreview();
    this.clearMessages();
  }

  dismissResult(): void {
    this.uploadResult.set(null);
  }

  // ── ภายใน ──────────────────────────────────────────────────

  /**
   * ล้างค่าใน <input type="file"> ของจริง
   *
   * ตั้ง signal เป็น null ทำให้ชื่อไฟล์ที่แสดงหาย แต่ค่าใน DOM ยังอยู่
   * ผู้ใช้ที่เลือกไฟล์เดิมซ้ำจะไม่เกิดเหตุการณ์ change และดูเหมือนปุ่มไม่ทำงาน
   */
  private resetBatchFileInputs(): void {
    const pdfInput = this.batchPdfInput()?.nativeElement;
    const txtInput = this.batchTxtInput()?.nativeElement;
    if (pdfInput) pdfInput.value = '';
    if (txtInput) txtInput.value = '';
  }

  private openInNewTab(url: string, revokeAfter: boolean): void {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.click();

    if (revokeAfter) {
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  }

  private revokeIndividualPreviewUrls(): void {
    this.individualPreviewItems().forEach((item) => {
      try {
        URL.revokeObjectURL(item.previewUrl);
      } catch {
        // ไม่ต้องทำอะไร URL ถูกคืนไปแล้ว
      }
    });
  }

  private clearPreview(): void {
    this.revokeIndividualPreviewUrls();

    this.previewMode.set(null);
    this.individualPreparedItems = [];
    this.individualPreviewItems.set([]);
    this.individualPreviewPage.set(1);
    this.batchPreviewRows.set([]);
    this.batchPreviewPage.set(1);
    this.batchPreviewPageCount.set(0);
    this.batchPreviewLineCount.set(0);
    this.batchPreviewDelimiter.set('');
    this.batchPreviewPdf = null;
  }

  private clearMessages(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  onIndividualPreviewPageChange(event: { page: number; pageSize: number }): void {
    this.individualPreviewPage.set(event.page);
    this.individualPreviewPageSize.set(event.pageSize);
  }

  onBatchPreviewPageChange(event: { page: number; pageSize: number }): void {
    this.batchPreviewPage.set(event.page);
    this.batchPreviewPageSize.set(event.pageSize);
  }
}
