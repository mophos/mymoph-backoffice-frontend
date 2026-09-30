import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { filter } from 'rxjs';
import { PDFDocument } from 'pdf-lib';
import {
  BatchUploadPreviewRow,
  IndividualUploadPreviewRow,
  TaxDocumentRow,
  TaxService,
  TaxYearRow,
  YearlyOverviewRow
} from './tax.service';
import { AuthService } from '../../core/auth/auth.service';
import { AppDialogService } from '../../shared/ui/dialog/dialog.service';
import { TableComponent, TableColumn } from '../../shared/ui/table/table.component';

interface IndividualUploadRow {
  cid: string;
  file: File | null;
}

interface IndividualPreparedItem {
  cid: string;
  file: File;
}

interface IndividualPreviewItem extends IndividualUploadPreviewRow {
  file: File;
  previewUrl: string;
}

type UploadPreviewMode = 'individual' | 'batch';
type ManageViewMode = 'documents' | 'upload' | 'yearly-overview';

@Component({
    selector: 'app-tax-management',
    imports: [FormsModule, TableComponent],
    templateUrl: './tax-management.component.html',
    providers: [DatePipe],
    changeDetection: ChangeDetectionStrategy.Eager
})
export class TaxManagementComponent implements OnInit, OnDestroy {
  years: TaxYearRow[] = [];
  selectedYearId: number | null = null;
  yearPage = 1;
  yearPageSize = 10;

  createYearForm = {
    yearBe: '',
    hospcode: ''
  };

  canManage = false;
  isSuperAdmin = false;
  canViewYearlyOverview = false;
  requiresHospcodeInput = false;
  scopeHospcodes: string[] = [];
  yearHospcodeSearch = '';
  yearHospcodeFilter = '';

  individualRows: IndividualUploadRow[] = [{ cid: '', file: null }];
  batchPdfFile: File | null = null;
  batchTxtFile: File | null = null;
  activePreviewMode: UploadPreviewMode | null = null;
  individualPreparedItems: IndividualPreparedItem[] = [];
  individualPreviewItems: IndividualPreviewItem[] = [];
  individualPreviewPage = 1;
  individualPreviewPageSize = 10;
  batchPreviewItems: BatchUploadPreviewRow[] = [];
  batchPreviewPage = 1;
  batchPreviewPageSize = 10;
  batchPreviewPageCount = 0;
  batchPreviewLineCount = 0;
  batchPreviewDelimiter = '';
  batchPreviewPdf: PDFDocument | null = null;
  previewLoading = false;
  confirmingPreview = false;
  activeManageView: ManageViewMode = 'documents';

  documents: TaxDocumentRow[] = [];
  search = '';
  page = 1;
  pageSize = 20;
  total = 0;
  yearlyOverviewRows: YearlyOverviewRow[] = [];
  yearlyOverviewSearch = '';
  yearlyOverviewPage = 1;
  yearlyOverviewPageSize = 20;
  yearlyOverviewTotal = 0;

  errorMessage = '';
  successMessage = '';

  documentsLoading = false;
  overviewLoading = false;

  /**
   * สรุปผลของการอัปโหลดรอบล่าสุด
   *
   * เดิมพออัปโหลดเสร็จจะกระโดดไปหน้ารายการเอกสารทันที ทำให้คนที่ต้องอัปหลายชุด
   * ติดกันต้องกดกลับมาเองทุกครั้ง และไม่ทันเห็นว่ารอบที่แล้วเข้าไปกี่รายการ
   * ตอนนี้อยู่หน้าเดิมแล้วสรุปผลไว้ให้ พร้อมปุ่มไปดูประวัติเมื่อต้องการ
   */
  uploadResult: { count: number; mode: UploadPreviewMode } | null = null;

  /**
   * ผู้ใช้ทุกคนในระบบมีขอบเขตหน่วยงานเดียว และ 100 จาก 103 หน่วยงานมีปีภาษีปีเดียว
   * ตารางปีจึงเป็นแถวเดียวที่กินพื้นที่เปล่า ๆ ย่อเก็บไว้เมื่อมีไม่เกินหนึ่งปี
   * ผู้ที่เห็นหลายปี (เช่น super_admin ที่เห็นครบ 106 ปี) ยังได้ตารางเต็มเหมือนเดิม
   */
  showYearList = false;

  /**
   * นิยามคอลัมน์ของแต่ละตาราง
   *
   * ตารางปี ตัวอย่างรายบุคคล และตัวอย่างแบบชุด แบ่งหน้าฝั่ง client เหมือนเดิม
   * (ข้อมูลมาครบชุดอยู่แล้ว) ส่วนรายการเอกสารและภาพรวมรายปีแบ่งหน้าฝั่ง server
   */
  readonly yearColumns: TableColumn<TaxYearRow>[] = [
    { key: 'yearBe', header: 'ปี พ.ศ.', cell: (row) => String(row.yearBe), cellClass: 'tabular-nums' },
    { key: 'hospcode', header: 'หน่วยงาน', cell: (row) => String(row.hospcode ?? '-'), cellClass: 'font-mono' },
    { key: 'count', header: 'จำนวนไฟล์', cell: (row) => String(row.documentCount ?? 0), cellClass: 'tabular-nums text-end whitespace-nowrap' },
    { key: 'updated', header: 'อัปเดตล่าสุด', cell: (row) => this.formatDateTime(row.updatedAt), hideOnMobile: true }
  ];

  readonly documentColumns: TableColumn<TaxDocumentRow>[] = [
    { key: 'file', header: 'ชื่อไฟล์', cell: (row) => String(row.file_name ?? '-'), cellClass: 'font-mono' },
    { key: 'type', header: 'ที่มา', cell: (row) => String(row.source_type ?? '-'), hideOnMobile: true },
    { key: 'updated', header: 'อัปเดตล่าสุด', cell: (row) => this.formatDateTime(row.updated_at), hideOnMobile: true }
  ];

  readonly overviewColumns: TableColumn<YearlyOverviewRow>[] = [
    { key: 'cid', header: 'เลขบัตรประชาชน', cell: (row) => String(row.cid ?? '-'), cellClass: 'font-mono tabular-nums' },
    { key: 'files', header: 'จำนวนไฟล์', cell: (row) => String(row.totalFiles ?? 0), cellClass: 'tabular-nums text-end whitespace-nowrap' },
    { key: 'offices', header: 'จำนวนหน่วยงาน', cell: (row) => String(row.hospcodeCount ?? 0), cellClass: 'tabular-nums text-end whitespace-nowrap' },
    { key: 'hospcodes', header: 'หน่วยงานที่พบ', cell: (row) => String(row.hospcodes || '-'), cellClass: 'font-mono', hideOnMobile: true },
    { key: 'updated', header: 'อัปเดตล่าสุด', cell: (row) => this.formatDateTime(row.updatedAt), hideOnMobile: true }
  ];

  readonly individualPreviewColumns: TableColumn<IndividualPreviewItem>[] = [
    { key: 'cid', header: 'เลขบัตรประชาชน', cell: (row) => String(row.cid ?? '-'), cellClass: 'font-mono tabular-nums' },
    { key: 'new', header: 'ชื่อไฟล์ใหม่', cell: (row) => String(row.fileName ?? '-'), cellClass: 'font-mono' },
    { key: 'origin', header: 'ไฟล์ต้นฉบับ', cell: (row) => String(row.originalFileName ?? '-'), hideOnMobile: true }
  ];

  readonly batchPreviewColumns: TableColumn<BatchUploadPreviewRow>[] = [
    { key: 'page', header: 'หน้า PDF', cell: (row) => String(row.pageNo), cellClass: 'tabular-nums text-end whitespace-nowrap' },
    { key: 'cid', header: 'เลขบัตรประชาชน', cell: (row) => String(row.cid ?? '-'), cellClass: 'font-mono tabular-nums' },
    { key: 'fileNo', header: 'ไฟล์ที่', cell: (row) => String(row.fileNo), cellClass: 'tabular-nums text-end whitespace-nowrap' },
    { key: 'new', header: 'ชื่อไฟล์ใหม่', cell: (row) => String(row.fileName ?? '-'), cellClass: 'font-mono' }
  ];

  constructor(
    private readonly taxService: TaxService,
    private readonly authService: AuthService,
    private readonly dialogs: AppDialogService,
    private readonly datePipe: DatePipe
  ) {}

  /** รูปแบบวันที่เดียวกับของเดิมทุกตาราง */
  formatDateTime(value: string | null | undefined): string {
    if (!value) return '-';
    return this.datePipe.transform(value, 'dd MMM yyyy HH:mm', 'Asia/Bangkok', 'th-TH') ?? '-';
  }

  ngOnInit(): void {
    const user = this.authService.currentUser;
    this.canManage = this.authService.hasPermission('payroll.export');
    this.isSuperAdmin = user?.roles?.includes('super_admin') ?? false;
    this.canViewYearlyOverview =
      (user?.roles?.includes('super_admin') ?? false) || (user?.roles?.includes('super_admin_affairs') ?? false);
    this.scopeHospcodes = user?.hospcodes ?? [];
    this.requiresHospcodeInput = this.isSuperAdmin || (user?.scopeType === 'LIST' && this.scopeHospcodes.length !== 1);

    if (this.isSuperAdmin) {
      this.createYearForm.hospcode = '';
    } else if (!this.requiresHospcodeInput && this.scopeHospcodes.length === 1) {
      this.createYearForm.hospcode = this.scopeHospcodes[0];
    } else if (this.scopeHospcodes.length) {
      this.createYearForm.hospcode = this.scopeHospcodes[0];
    }

    this.loadYears();
  }

  ngOnDestroy(): void {
    this.clearUploadPreview(true);
  }

  get selectedYear(): TaxYearRow | null {
    return this.years.find((item) => item.id === this.selectedYearId) ?? null;
  }

  /**
   * เลขปีสองหลักท้ายที่ใช้ขึ้นต้นชื่อไฟล์
   *
   * เดิมอ่านจาก createYearForm ซึ่งเป็นฟอร์ม "เพิ่มปี" ไม่ใช่ปีที่กำลังเปิดอยู่
   * ผลคือหัวข้อแสดง YY_เลขบัตร_ลำดับ.pdf เกือบตลอดเวลา เพราะฟอร์มนั้นว่าง
   * ตอนนี้ยึดปีที่เปิดอยู่เป็นหลัก และใช้ค่าที่กำลังพิมพ์เฉพาะตอนยังไม่ได้เลือกปี
   */
  get selectedYearShortPreview(): string {
    const yearBe = this.selectedYear
      ? Number(this.selectedYear.yearBe)
      : this.normalizeYearBe(this.createYearForm.yearBe);
    if (yearBe === null || !Number.isInteger(yearBe)) return 'YY';
    return String(yearBe % 100).padStart(2, '0');
  }

  get yearTotal(): number {
    return this.years.length;
  }

  get yearTotalPages(): number {
    return this.yearTotal > 0 ? Math.ceil(this.yearTotal / this.yearPageSize) : 1;
  }

  get pagedYears(): TaxYearRow[] {
    const start = (this.yearPage - 1) * this.yearPageSize;
    return this.years.slice(start, start + this.yearPageSize);
  }

  get individualPreviewTotal(): number {
    return this.individualPreviewItems.length;
  }

  get individualPreviewTotalPages(): number {
    return this.individualPreviewTotal > 0 ? Math.ceil(this.individualPreviewTotal / this.individualPreviewPageSize) : 1;
  }

  get pagedIndividualPreviewItems(): IndividualPreviewItem[] {
    const start = (this.individualPreviewPage - 1) * this.individualPreviewPageSize;
    return this.individualPreviewItems.slice(start, start + this.individualPreviewPageSize);
  }

  get batchPreviewTotal(): number {
    return this.batchPreviewItems.length;
  }

  get batchPreviewTotalPages(): number {
    return this.batchPreviewTotal > 0 ? Math.ceil(this.batchPreviewTotal / this.batchPreviewPageSize) : 1;
  }

  get pagedBatchPreviewItems(): BatchUploadPreviewRow[] {
    const start = (this.batchPreviewPage - 1) * this.batchPreviewPageSize;
    return this.batchPreviewItems.slice(start, start + this.batchPreviewPageSize);
  }

  get totalPages(): number {
    return this.total > 0 ? Math.ceil(this.total / this.pageSize) : 1;
  }

  get yearlyOverviewTotalPages(): number {
    return this.yearlyOverviewTotal > 0 ? Math.ceil(this.yearlyOverviewTotal / this.yearlyOverviewPageSize) : 1;
  }

  loadYears(): void {
    this.taxService.listYears(this.yearHospcodeFilter || undefined).subscribe({
      next: (res) => {
        this.years = res.data || [];
        if (this.yearPage > this.yearTotalPages) {
          this.yearPage = this.yearTotalPages;
        }

        if (!this.years.length) {
          this.selectedYearId = null;
          this.documents = [];
          this.total = 0;
          this.yearlyOverviewRows = [];
          this.yearlyOverviewTotal = 0;
          this.clearUploadPreview(true);
          return;
        }

        if (!this.selectedYearId || !this.years.some((item) => item.id === this.selectedYearId)) {
          this.selectedYearId = this.years[0].id;
          this.page = 1;
        }

        this.ensureSelectedYearVisible();
        this.loadSelectedManageViewData();
      },
      error: (error) => this.handleApiError(error, 'LOAD_TAX_YEARS_FAILED')
    });
  }

  searchYearByHospcode(): void {
    this.yearHospcodeFilter = this.yearHospcodeSearch.trim();
    this.yearPage = 1;
    this.loadYears();
  }

  resetYearHospcodeSearch(): void {
    this.yearHospcodeSearch = '';
    this.yearHospcodeFilter = '';
    this.yearPage = 1;
    this.loadYears();
  }

  createYear(): void {
    this.clearMessages();
    const yearBe = this.normalizeYearBe(this.createYearForm.yearBe);
    if (yearBe === null) {
      this.handleError('INVALID_YEAR_BE');
      return;
    }

    this.taxService
      .createYear({
        yearBe,
        hospcode: this.createYearForm.hospcode?.trim() || undefined
      })
      .subscribe({
        next: (res) => {
          this.successMessage = 'เพิ่มปี พ.ศ. สำเร็จ';
          const createdYearId = Number(res?.data?.id ?? 0);
          if (Number.isInteger(createdYearId) && createdYearId > 0) {
            this.selectedYearId = createdYearId;
            this.page = 1;
            this.activeManageView = 'documents';
          }
          this.createYearForm.hospcode = '';
          this.loadYears();
        },
        error: (error) => this.handleApiError(error, 'CREATE_TAX_YEAR_FAILED')
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
    this.taxService.deleteYear(year.id).subscribe({
      next: () => {
        this.successMessage = 'ลบปี พ.ศ. สำเร็จ';
        if (this.selectedYearId === year.id) {
          this.selectedYearId = null;
          this.documents = [];
          this.total = 0;
        }
        this.loadYears();
      },
      error: (error) => this.handleApiError(error, 'DELETE_TAX_YEAR_FAILED')
    });
  }

  selectYear(yearId: number): void {
    this.clearMessages();
    this.uploadResult = null;
    this.clearUploadPreview(true);
    this.selectedYearId = yearId;
    this.ensureSelectedYearVisible();
    this.page = 1;
    this.yearlyOverviewPage = 1;
    this.loadSelectedManageViewData();
  }

  setManageView(view: ManageViewMode): void {
    if (view === 'yearly-overview' && !this.canViewYearlyOverview) {
      return;
    }
    if (view !== 'upload') this.uploadResult = null;
    this.activeManageView = view;
    this.loadSelectedManageViewData();
  }

  goToHistory(): void {
    this.uploadResult = null;
    this.activeManageView = 'documents';
    this.page = 1;
    this.loadDocuments();
  }

  toggleYearList(): void {
    this.showYearList = !this.showYearList;
  }

  /** ย่อได้เมื่อมีปีเดียวและไม่ได้กำลังค้นหา */
  get canCollapseYearList(): boolean {
    return this.years.length <= 1 && !this.yearHospcodeFilter;
  }

  get yearListVisible(): boolean {
    return this.showYearList || !this.canCollapseYearList;
  }

  onYearPageChange(event: { page: number; pageSize: number }): void {
    this.yearPage = event.page;
    this.yearPageSize = event.pageSize;
  }

  onDocumentPageChange(event: { page: number; pageSize: number }): void {
    this.page = event.page;
    this.pageSize = event.pageSize;
    this.loadDocuments();
  }

  onOverviewPageChange(event: { page: number; pageSize: number }): void {
    this.yearlyOverviewPage = event.page;
    this.yearlyOverviewPageSize = event.pageSize;
    this.loadYearlyOverview();
  }

  onIndividualPreviewPageChange(event: { page: number; pageSize: number }): void {
    this.individualPreviewPage = event.page;
    this.individualPreviewPageSize = event.pageSize;
  }

  onBatchPreviewPageChange(event: { page: number; pageSize: number }): void {
    this.batchPreviewPage = event.page;
    this.batchPreviewPageSize = event.pageSize;
  }

  addIndividualRow(): void {
    this.clearUploadPreview(true);
    this.individualRows.push({ cid: '', file: null });
  }

  removeIndividualRow(index: number): void {
    this.clearUploadPreview(true);
    if (this.individualRows.length <= 1) return;
    this.individualRows.splice(index, 1);
  }

  onIndividualFileChange(event: Event, index: number): void {
    this.clearUploadPreview(true);
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.individualRows[index].file = file;
  }

  prepareIndividualUploadPreview(): void {
    this.clearMessages();
    this.uploadResult = null;
    if (!this.selectedYearId) return;
    this.activeManageView = 'upload';

    const items = this.individualRows
      .filter((row) => row.cid.trim() || row.file)
      .map((row) => ({ cid: row.cid.trim(), file: row.file }));

    if (!items.length) {
      this.handleError('NO_UPLOAD_ITEMS');
      return;
    }

    if (items.some((item) => !item.cid || !item.file)) {
      this.handleError('CID_OR_FILE_MISSING');
      return;
    }

    if (items.some((item) => !item.file!.name.toLowerCase().endsWith('.pdf'))) {
      this.handleError('ONLY_PDF_ALLOWED');
      return;
    }

    this.previewLoading = true;

    const preparedItems = items.map((item) => ({ cid: item.cid, file: item.file! }));
    this.taxService.previewUploadIndividual(this.selectedYearId, preparedItems).subscribe({
      next: (res) => {
        this.clearUploadPreview(true);
        const previewRows = Array.isArray(res.data?.rows) ? res.data.rows : [];
        if (previewRows.length !== preparedItems.length) {
          this.handleError('PREVIEW_RESPONSE_MISMATCH');
          this.previewLoading = false;
          return;
        }

        this.individualPreparedItems = preparedItems;
        this.individualPreviewItems = previewRows.map((row, index) => ({
          ...row,
          file: preparedItems[index].file,
          previewUrl: URL.createObjectURL(preparedItems[index].file)
        }));
        this.individualPreviewPage = 1;
        this.activePreviewMode = 'individual';
        this.successMessage = 'ตรวจสอบผ่านแล้ว กรุณาตรวจตัวอย่างก่อนยืนยันบันทึกจริง';
        this.previewLoading = false;
      },
      error: (error) => {
        this.previewLoading = false;
        this.handleApiError(error, 'PREVIEW_INDIVIDUAL_FAILED');
      }
    });
  }

  onBatchPdfChange(event: Event): void {
    this.clearUploadPreview(true);
    const input = event.target as HTMLInputElement;
    this.batchPdfFile = input.files?.[0] ?? null;
  }

  onBatchTxtChange(event: Event): void {
    this.clearUploadPreview(true);
    const input = event.target as HTMLInputElement;
    this.batchTxtFile = input.files?.[0] ?? null;
  }

  prepareBatchUploadPreview(): void {
    this.clearMessages();
    this.uploadResult = null;
    if (!this.selectedYearId) return;
    this.activeManageView = 'upload';

    if (!this.batchPdfFile || !this.batchTxtFile) {
      this.handleError('PDF_AND_TXT_REQUIRED');
      return;
    }

    if (!this.isPdfFile(this.batchPdfFile)) {
      this.handleError('ONLY_PDF_ALLOWED');
      return;
    }

    if (!this.isTxtFile(this.batchTxtFile)) {
      this.handleError('INVALID_TXT_FILE');
      return;
    }

    this.previewLoading = true;
    this.taxService.previewUploadBatch(this.selectedYearId, this.batchPdfFile, this.batchTxtFile).subscribe({
      next: (res) => {
        this.clearUploadPreview(true);
        this.batchPreviewItems = Array.isArray(res.data?.rows) ? res.data.rows : [];
        this.batchPreviewPageCount = Number(res.data?.pageCount || 0);
        this.batchPreviewLineCount = Number(res.data?.lineCount || 0);
        this.batchPreviewDelimiter = String(res.data?.delimiter || '');
        this.batchPreviewPage = 1;
        this.activePreviewMode = 'batch';
        this.successMessage = 'ตรวจสอบผ่านแล้ว กรุณาตรวจตัวอย่างก่อนยืนยันบันทึกจริง';
        this.previewLoading = false;
      },
      error: (error) => {
        this.previewLoading = false;
        this.handleApiError(error, 'PREVIEW_BATCH_FAILED');
      }
    });
  }

  confirmPreviewUpload(): void {
    if (!this.selectedYearId) return;
    if (!this.activePreviewMode) {
      this.handleError('NO_PREVIEW_TO_CONFIRM');
      return;
    }

    this.confirmingPreview = true;

    if (this.activePreviewMode === 'individual') {
      if (!this.individualPreparedItems.length) {
        this.confirmingPreview = false;
        this.handleError('NO_PREVIEW_TO_CONFIRM');
        return;
      }

      this.taxService.uploadIndividual(this.selectedYearId, this.individualPreparedItems).subscribe({
        next: (res) => {
          this.confirmingPreview = false;
          this.uploadResult = { count: Number(res.data?.createdCount ?? 0), mode: 'individual' };
          this.individualRows = [{ cid: '', file: null }];
          this.page = 1;
          this.clearUploadPreview(true);
          this.loadYears();
        },
        error: (error) => {
          this.confirmingPreview = false;
          this.handleApiError(error, 'UPLOAD_INDIVIDUAL_FAILED');
        }
      });
      return;
    }

    if (!this.batchPdfFile || !this.batchTxtFile || !this.batchPreviewItems.length) {
      this.confirmingPreview = false;
      this.handleError('NO_PREVIEW_TO_CONFIRM');
      return;
    }

    this.taxService.uploadBatch(this.selectedYearId, this.batchPdfFile, this.batchTxtFile).subscribe({
      next: (res) => {
        const createdCount = res.data?.createdCount ?? 0;
        this.confirmingPreview = false;
        this.uploadResult = { count: createdCount, mode: 'batch' };
        this.batchPdfFile = null;
        this.batchTxtFile = null;
        this.page = 1;
        this.clearUploadPreview(true);
        this.loadYears();
      },
      error: (error) => {
        this.confirmingPreview = false;
        this.handleApiError(error, 'UPLOAD_BATCH_FAILED');
      }
    });
  }

  cancelUploadPreview(): void {
    this.clearUploadPreview(true);
  }

  openIndividualPreview(item: IndividualPreviewItem): void {
    const anchor = document.createElement('a');
    anchor.href = item.previewUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.click();
  }

  openBatchSplitPreview(item: BatchUploadPreviewRow): void {
    void this.openBatchSplitPreviewAsync(item);
  }

  private loadSelectedManageViewData(): void {
    if (this.activeManageView === 'yearly-overview') {
      this.loadYearlyOverview();
      return;
    }

    this.loadDocuments();
  }

  loadYearlyOverview(): void {
    if (!this.selectedYearId) return;
    if (!this.canViewYearlyOverview) return;
    this.overviewLoading = true;

    this.taxService
      .listYearlyOverview({
        yearId: this.selectedYearId,
        search: this.yearlyOverviewSearch.trim() || undefined,
        page: this.yearlyOverviewPage,
        pageSize: this.yearlyOverviewPageSize
      })
      .subscribe({
        next: (res) => {
          this.yearlyOverviewRows = res.data?.rows || [];
          this.yearlyOverviewTotal = Number(res.data?.total || 0);
          this.overviewLoading = false;
          if (this.yearlyOverviewPage > this.yearlyOverviewTotalPages) {
            this.yearlyOverviewPage = this.yearlyOverviewTotalPages;
            this.loadYearlyOverview();
          }
        },
        error: (error) => {
          this.overviewLoading = false;
          this.handleApiError(error, 'LOAD_TAX_YEARLY_OVERVIEW_FAILED');
        }
      });
  }

  loadDocuments(): void {
    if (!this.selectedYearId) return;
    this.documentsLoading = true;

    this.taxService
      .listDocuments({
        yearId: this.selectedYearId,
        search: this.search.trim() || undefined,
        page: this.page,
        pageSize: this.pageSize
      })
      .subscribe({
        next: (res) => {
          this.documents = res.data?.rows || [];
          this.total = Number(res.data?.total || 0);
          this.documentsLoading = false;
          if (this.page > this.totalPages) {
            this.page = this.totalPages;
            this.loadDocuments();
          }
        },
        error: (error) => {
          this.documentsLoading = false;
          this.handleApiError(error, 'LOAD_TAX_DOCUMENTS_FAILED');
        }
      });
  }

  searchYearlyOverview(): void {
    this.activeManageView = 'yearly-overview';
    this.yearlyOverviewPage = 1;
    this.loadYearlyOverview();
  }

  resetYearlyOverviewSearch(): void {
    this.activeManageView = 'yearly-overview';
    this.yearlyOverviewSearch = '';
    this.yearlyOverviewPage = 1;
    this.loadYearlyOverview();
  }

  searchSubmit(): void {
    this.activeManageView = 'documents';
    this.page = 1;
    this.loadDocuments();
  }

  resetSearch(): void {
    this.activeManageView = 'documents';
    this.search = '';
    this.page = 1;
    this.loadDocuments();
  }

  downloadDocument(row: TaxDocumentRow): void {
    this.taxService.downloadDocument(row.id).subscribe({
      next: (response) => {
        const blob = response.body;
        if (!blob) {
          this.handleError('EMPTY_DOWNLOAD_FILE');
          return;
        }

        const pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
        const url = URL.createObjectURL(pdfBlob);
        const openedWindow = window.open(url, '_blank', 'noopener,noreferrer');
        if (!openedWindow) {
          this.handleError('OPEN_PREVIEW_POPUP_BLOCKED');
          URL.revokeObjectURL(url);
          return;
        }

        window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      },
      error: (error) => this.handleApiError(error, 'DOWNLOAD_TAX_FILE_FAILED')
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
      .subscribe(() => this.runDeleteDocument(row));
  }

  private runDeleteDocument(row: TaxDocumentRow): void {
    this.taxService.deleteDocument(row.id).subscribe({
      next: () => {
        this.successMessage = 'ลบรายการสำเร็จ';
        this.loadDocuments();
        this.loadYears();
      },
      error: (error) => this.handleApiError(error, 'DELETE_TAX_DOCUMENT_FAILED')
    });
  }

  private async openBatchSplitPreviewAsync(item: BatchUploadPreviewRow): Promise<void> {
    if (!this.batchPdfFile) {
      this.handleError('PDF_AND_TXT_REQUIRED');
      return;
    }

    const sourcePdf = await this.getBatchPreviewPdf();
    if (!sourcePdf) {
      this.handleError('INVALID_PDF_FILE');
      return;
    }

    const pageIndex = Number(item.pageNo) - 1;
    if (pageIndex < 0 || pageIndex >= sourcePdf.getPageCount()) {
      this.handleError('INVALID_PREVIEW_PAGE');
      return;
    }

    const pagePdf = await PDFDocument.create();
    const [copiedPage] = await pagePdf.copyPages(sourcePdf, [pageIndex]);
    pagePdf.addPage(copiedPage);
    const pageBytes = await pagePdf.save();
    // TypeScript 5.9 ทำให้ Uint8Array เป็น generic: สำเนาเพื่อยืนยันว่า buffer เป็น ArrayBuffer ไม่ใช่ SharedArrayBuffer
    const blob = new Blob([new Uint8Array(pageBytes)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.click();

    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  private async getBatchPreviewPdf(): Promise<PDFDocument | null> {
    if (this.batchPreviewPdf) return this.batchPreviewPdf;
    if (!this.batchPdfFile) return null;

    try {
      const fileBuffer = await this.batchPdfFile.arrayBuffer();
      this.batchPreviewPdf = await PDFDocument.load(fileBuffer);
      return this.batchPreviewPdf;
    } catch (_error) {
      return null;
    }
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  private clearUploadPreview(keepMessages = false): void {
    this.individualPreviewItems.forEach((item) => {
      try {
        URL.revokeObjectURL(item.previewUrl);
      } catch (_error) {
        // no-op
      }
    });

    this.activePreviewMode = null;
    this.individualPreparedItems = [];
    this.individualPreviewItems = [];
    this.individualPreviewPage = 1;
    this.batchPreviewItems = [];
    this.batchPreviewPage = 1;
    this.batchPreviewPageCount = 0;
    this.batchPreviewLineCount = 0;
    this.batchPreviewDelimiter = '';
    this.batchPreviewPdf = null;
    this.previewLoading = false;
    this.confirmingPreview = false;

    if (!keepMessages) {
      this.clearMessages();
    }
  }

  private isPdfFile(file: File): boolean {
    const filename = String(file.name || '').toLowerCase();
    const mime = String(file.type || '').toLowerCase();
    return mime === 'application/pdf' || filename.endsWith('.pdf');
  }

  private isTxtFile(file: File): boolean {
    const filename = String(file.name || '').toLowerCase();
    const mime = String(file.type || '').toLowerCase();
    return mime === 'text/plain' || filename.endsWith('.txt');
  }

  private normalizeYearBe(input: string | number | null | undefined): number | null {
    const raw = String(input ?? '').trim();
    if (!raw) return null;

    const year = Number(raw);
    if (!Number.isInteger(year) || year < 0) return null;

    const yearBe = year < 100 ? 2500 + year : year;
    if (yearBe < 2500 || yearBe > 3000) return null;

    return yearBe;
  }

  private ensureSelectedYearVisible(): void {
    if (!this.selectedYearId) return;
    const index = this.years.findIndex((year) => year.id === this.selectedYearId);
    if (index < 0) return;
    this.yearPage = Math.floor(index / this.yearPageSize) + 1;
  }

  private handleError(errorCode: string): void {
    this.errorMessage = this.translateError(errorCode);
    this.successMessage = '';
  }

  private handleApiError(error: any, fallbackCode: string): void {
    const resolvedCode = this.resolveErrorCode(error, fallbackCode);
    this.handleError(resolvedCode);
    console.error('[tax-management] api-error', error);
  }

  private resolveErrorCode(error: any, fallbackCode: string): string {
    if (!error) return fallbackCode;

    if (typeof error === 'string') return error;

    const payload = error.error ?? error;
    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        if (parsed && typeof parsed.error === 'string') {
          return parsed.error;
        }
      } catch (_ignored) {
        if (payload.trim().length > 0) return payload;
      }
      return fallbackCode;
    }

    if (payload && typeof payload === 'object') {
      if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
        return payload.error;
      }

      if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
        return payload.message;
      }
    }

    if (typeof error.message === 'string' && error.message.trim().length > 0) {
      return error.message;
    }

    return fallbackCode;
  }

  private translateError(errorCode: string): string {
    const map: Record<string, string> = {
      INVALID_YEAR_BE: 'ปี พ.ศ. ไม่ถูกต้อง',
      TAX_YEAR_ALREADY_EXISTS: 'ปี พ.ศ. นี้มีอยู่แล้ว',
      HOSPCODE_REQUIRED: 'กรุณาระบุ Hospcode',
      HOSPCODE_NOT_FOUND: 'ไม่พบรหัสหน่วยงานนี้ในทะเบียนกลาง',
      OFFICE_WITHOUT_CODE5: 'หน่วยงานนี้ยังไม่มีรหัส 5 หลัก จึงยังสร้างปีภาษีไม่ได้',
      TAX_YEAR_NOT_FOUND: 'ไม่พบปี พ.ศ. ที่เลือก',
      TAX_DOCUMENT_NOT_FOUND: 'ไม่พบรายการไฟล์',
      SCOPE_FORBIDDEN: 'ไม่มีสิทธิ์เข้าถึงข้อมูลหน่วยงานนี้',
      FORBIDDEN: 'ไม่มีสิทธิ์เข้าถึงข้อมูลส่วนนี้',
      INVALID_CID: 'เลขบัตรต้องเป็นตัวเลข 13 หลัก',
      CID_OR_FILE_MISSING: 'กรุณากรอกเลขบัตรและเลือกไฟล์ให้ครบทุกแถว',
      NO_UPLOAD_ITEMS: 'กรุณาเพิ่มรายการที่จะอัปโหลดอย่างน้อย 1 รายการ',
      EMPTY_UPLOAD_ITEMS: 'กรุณาเพิ่มรายการที่จะอัปโหลดอย่างน้อย 1 รายการ',
      FILES_AND_CIDS_REQUIRED: 'กรุณาเลือกไฟล์ PDF และระบุ CID ให้ครบ',
      FILES_CIDS_LENGTH_MISMATCH: 'จำนวนไฟล์ PDF และ CID ไม่เท่ากัน',
      PDF_AND_TXT_REQUIRED: 'กรุณาเลือกไฟล์ PDF และ TXT',
      PDF_PAGE_COUNT_MISMATCH_TXT_LINES: 'จำนวนหน้า PDF ไม่เท่าจำนวนบรรทัดใน TXT',
      TXT_PATTERN_INVALID: 'รูปแบบไฟล์ TXT ไม่ถูกต้องตาม pattern ที่กำหนด',
      EMPTY_TXT_FILE: 'ไฟล์ TXT ว่างหรือไม่มีข้อมูลที่ใช้งานได้',
      ONLY_PDF_ALLOWED: 'รองรับเฉพาะไฟล์ PDF',
      INVALID_PDF_FILE: 'ไฟล์ PDF ไม่ถูกต้องหรือเปิดอ่านไม่ได้',
      INVALID_TXT_FILE: 'กรุณาเลือกไฟล์ TXT เท่านั้น',
      INDIVIDUAL_PDF_MUST_HAVE_SINGLE_PAGE: 'ไฟล์ PDF แบบรายบุคคลต้องมี 1 หน้าเท่านั้น',
      EMPTY_UPDATE_PAYLOAD: 'ยังไม่มีข้อมูลที่ต้องการแก้ไข',
      FILE_NOT_FOUND: 'ไม่พบไฟล์ในระบบจัดเก็บ',
      PREVIEW_RESPONSE_MISMATCH: 'ข้อมูลตัวอย่างไม่ครบถ้วน กรุณาลองใหม่อีกครั้ง',
      NO_PREVIEW_TO_CONFIRM: 'ยังไม่มีตัวอย่างสำหรับยืนยันบันทึก',
      INVALID_PREVIEW_PAGE: 'ไม่สามารถเปิดหน้า PDF ตัวอย่างที่เลือกได้',
      OPEN_PREVIEW_POPUP_BLOCKED: 'เบราว์เซอร์บล็อกการเปิดแท็บใหม่ กรุณาอนุญาต pop-up สำหรับเว็บไซต์นี้'
    };

    return map[errorCode] ?? `เกิดข้อผิดพลาด: ${errorCode}`;
  }

  private extractFilename(contentDisposition: string | null): string {
    if (!contentDisposition) return '';
    const utf8Match = contentDisposition.match(/filename\\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1]).replace(/["']/g, '');
    }

    const basicMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
    return basicMatch?.[1] ?? '';
  }
}
