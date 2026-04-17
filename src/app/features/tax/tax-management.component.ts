import { Component, OnDestroy, OnInit } from '@angular/core';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PDFDocument } from 'pdf-lib';
import {
  BatchUploadPreviewRow,
  IndividualUploadPreviewRow,
  TaxDocumentRow,
  TaxService,
  TaxYearRow
} from './tax.service';
import { AuthService } from '../../core/auth/auth.service';

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
type ManageViewMode = 'documents' | 'upload';

@Component({
  selector: 'app-tax-management',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, DatePipe],
  template: `
    <section class="card">
      <h2>ใบรับรองภาษี (Tax)</h2>
      <p class="note">ใช้สิทธิ์เดียวกับ Payroll | ชื่อไฟล์มาตรฐาน: {{ selectedYearShortPreview }}_เลขบัตร_ลำดับ.pdf</p>

      <div class="year-create" *ngIf="canManage">
        <input type="number" [(ngModel)]="createYearForm.yearBe" placeholder="ปี พ.ศ. เช่น 2568 หรือ 68" />
        <input
          *ngIf="requiresHospcodeInput"
          [(ngModel)]="createYearForm.hospcode"
          maxlength="10"
          placeholder="Hospcode"
        />
        <button (click)="createYear()">เพิ่มปี พ.ศ.</button>
      </div>

      <p class="note" *ngIf="!canManage">บัญชีนี้เป็นโหมดอ่านอย่างเดียว (ไม่มีสิทธิ์ payroll.export)</p>
      <p class="error" *ngIf="errorMessage">{{ errorMessage }}</p>
      <div class="error-banner" *ngIf="errorMessage">
        <strong>เกิดข้อผิดพลาด:</strong> {{ errorMessage }}
      </div>
      <p class="success" *ngIf="successMessage">{{ successMessage }}</p>

      <table class="compact-table" *ngIf="years.length; else emptyYear">
        <thead>
          <tr>
            <th>ปี พ.ศ.</th>
            <th>Hospcode</th>
            <th>จำนวนไฟล์</th>
            <th>Updated</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let year of pagedYears" [class.selected]="selectedYearId === year.id">
            <td>{{ year.yearBe }}</td>
            <td>{{ year.hospcode }}</td>
            <td>{{ year.documentCount }}</td>
            <td>{{ year.updatedAt | date:'dd MMM yyyy HH:mm':'Asia/Bangkok':'th-TH' }}</td>
            <td class="actions">
              <button class="ghost" (click)="selectYear(year.id)">เปิด</button>
              <ng-container *ngIf="canManage">
                <button class="danger" (click)="deleteYear(year)">ลบ</button>
              </ng-container>
            </td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyYear>
        <p class="empty">ยังไม่มีปี พ.ศ. สำหรับโมดูลภาษี</p>
      </ng-template>

      <div class="pagination" *ngIf="yearTotal > 0">
        <span>Showing {{ yearStartItem }}-{{ yearEndItem }} of {{ yearTotal }}</span>
        <div class="pager-actions">
          <button class="ghost" [disabled]="yearPage <= 1" (click)="prevYearPage()">Prev</button>
          <span>Page {{ yearPage }} / {{ yearTotalPages }}</span>
          <button class="ghost" [disabled]="yearPage >= yearTotalPages" (click)="nextYearPage()">Next</button>
        </div>
      </div>
    </section>

    <section class="card" *ngIf="selectedYearId">
      <div class="manage-head">
        <h3>จัดการปี {{ selectedYear?.yearBe }} ({{ selectedYear?.hospcode }})</h3>
        <div class="view-switch">
          <button
            class="ghost"
            [class.active]="activeManageView === 'documents'"
            (click)="setManageView('documents')"
          >
            รายการเอกสาร
          </button>
          <button
            *ngIf="canManage"
            class="ghost"
            [class.active]="activeManageView === 'upload'"
            (click)="setManageView('upload')"
          >
            อัปโหลด
          </button>
        </div>
      </div>

      <div class="upload-grid" *ngIf="canManage && activeManageView === 'upload'">
        <section class="upload-box">
          <h4>เพิ่มแบบรายบุคคล</h4>
          <p class="note">เพิ่มหลายรายการได้ในครั้งเดียว (cid + pdf) และตรวจว่า PDF ต้องมี 1 หน้า</p>

          <div class="person-row" *ngFor="let row of individualRows; let i = index">
            <input [(ngModel)]="row.cid" maxlength="13" placeholder="เลขบัตร 13 หลัก" />
            <input type="file" accept=".pdf,application/pdf" (change)="onIndividualFileChange($event, i)" />
            <button class="ghost" (click)="removeIndividualRow(i)" [disabled]="individualRows.length === 1">ลบ</button>
          </div>

          <div class="inline-actions">
            <button class="ghost" (click)="addIndividualRow()">+ เพิ่มแถว</button>
            <button [disabled]="previewLoading || confirmingPreview" (click)="prepareIndividualUploadPreview()">
              ตรวจสอบก่อนบันทึก
            </button>
          </div>
        </section>

        <section class="upload-box">
          <h4>เพิ่มแบบเป็นชุด (pdf + txt)</h4>
          <p class="note">ตรวจจำนวนหน้า pdf เท่าจำนวนบรรทัด txt และตรวจ pattern อัตโนมัติ</p>
          <label class="file-field">
            <span>PDF ต้นฉบับ</span>
            <input type="file" accept=".pdf,application/pdf" (change)="onBatchPdfChange($event)" />
            <small *ngIf="batchPdfFile">{{ batchPdfFile.name }}</small>
          </label>
          <label class="file-field">
            <span>TXT mapping</span>
            <input type="file" accept=".txt,text/plain" (change)="onBatchTxtChange($event)" />
            <small *ngIf="batchTxtFile">{{ batchTxtFile.name }}</small>
          </label>
          <button [disabled]="previewLoading || confirmingPreview" (click)="prepareBatchUploadPreview()">
            ตรวจสอบก่อนบันทึก
          </button>
        </section>
      </div>

      <section class="preview-box" *ngIf="activeManageView === 'upload' && activePreviewMode">
        <h4>ตัวอย่างก่อนบันทึกจริง</h4>
        <p class="note">ตรวจชื่อไฟล์และ PDF ตัวอย่างให้ถูกต้อง แล้วค่อยยืนยันบันทึก</p>

        <div *ngIf="activePreviewMode === 'individual'">
          <table class="preview-table" *ngIf="individualPreviewItems.length">
            <thead>
              <tr>
                <th>CID</th>
                <th>ไฟล์ใหม่</th>
                <th>ไฟล์ต้นฉบับ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of pagedIndividualPreviewItems">
                <td>{{ item.cid }}</td>
                <td>{{ item.fileName }}</td>
                <td>{{ item.originalFileName }}</td>
                <td>
                  <button class="ghost" (click)="openIndividualPreview(item)">ดู PDF</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="pagination" *ngIf="individualPreviewTotal > 0">
            <span>Showing {{ individualPreviewStartItem }}-{{ individualPreviewEndItem }} of {{ individualPreviewTotal }}</span>
            <div class="pager-actions">
              <button class="ghost" [disabled]="individualPreviewPage <= 1" (click)="prevIndividualPreviewPage()">Prev</button>
              <span>Page {{ individualPreviewPage }} / {{ individualPreviewTotalPages }}</span>
              <button class="ghost" [disabled]="individualPreviewPage >= individualPreviewTotalPages" (click)="nextIndividualPreviewPage()">Next</button>
            </div>
          </div>
        </div>

        <div *ngIf="activePreviewMode === 'batch'">
          <p class="note">
            จำนวนหน้า PDF: {{ batchPreviewPageCount }} | จำนวนบรรทัด TXT: {{ batchPreviewLineCount }} | Delimiter: {{ batchPreviewDelimiter }}
          </p>
          <table class="preview-table" *ngIf="batchPreviewItems.length">
            <thead>
              <tr>
                <th>หน้า PDF</th>
                <th>CID</th>
                <th>ไฟล์ที่</th>
                <th>ไฟล์ใหม่</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of pagedBatchPreviewItems">
                <td>{{ item.pageNo }}</td>
                <td>{{ item.cid }}</td>
                <td>{{ item.fileNo }}</td>
                <td>{{ item.fileName }}</td>
                <td>
                  <button class="ghost" (click)="openBatchSplitPreview(item)">ดู PDF ที่ตัดแล้ว</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="pagination" *ngIf="batchPreviewTotal > 0">
            <span>Showing {{ batchPreviewStartItem }}-{{ batchPreviewEndItem }} of {{ batchPreviewTotal }}</span>
            <div class="pager-actions">
              <button class="ghost" [disabled]="batchPreviewPage <= 1" (click)="prevBatchPreviewPage()">Prev</button>
              <span>Page {{ batchPreviewPage }} / {{ batchPreviewTotalPages }}</span>
              <button class="ghost" [disabled]="batchPreviewPage >= batchPreviewTotalPages" (click)="nextBatchPreviewPage()">Next</button>
            </div>
          </div>
        </div>

        <div class="inline-actions">
          <button [disabled]="confirmingPreview" (click)="confirmPreviewUpload()">
            {{ confirmingPreview ? 'กำลังบันทึก...' : 'ยืนยันบันทึกจริง' }}
          </button>
          <button class="ghost" [disabled]="confirmingPreview" (click)="cancelUploadPreview()">ยกเลิก</button>
        </div>
      </section>

      <div *ngIf="activeManageView === 'documents'">
        <div class="toolbar">
          <input [(ngModel)]="search" placeholder="ค้นหาเลขบัตร/ชื่อไฟล์" (keyup.enter)="searchSubmit()" />
          <button (click)="searchSubmit()">Search</button>
          <button class="ghost" (click)="resetSearch()">Clear</button>
        </div>

        <table class="compact-table" *ngIf="documents.length; else emptyDocument">
          <thead>
            <tr>
              <th>ชื่อไฟล์</th>
              <th>ประเภท</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of documents">
              <td class="file-name" [title]="row.file_name">{{ row.file_name }}</td>
              <td>{{ row.source_type }}</td>
              <td>{{ row.updated_at | date:'dd MMM yyyy HH:mm':'Asia/Bangkok':'th-TH' }}</td>
              <td class="actions">
                <button class="ghost" (click)="downloadDocument(row)">เปิดไฟล์</button>
                <ng-container *ngIf="canManage">
                  <button class="danger" (click)="deleteDocument(row)">ลบ</button>
                </ng-container>
              </td>
            </tr>
          </tbody>
        </table>

        <ng-template #emptyDocument>
          <p class="empty">ยังไม่มีรายการรายบุคคลในปีนี้</p>
        </ng-template>

        <div class="pagination" *ngIf="total > 0">
          <span>Showing {{ startItem }}-{{ endItem }} of {{ total }}</span>
          <div class="pager-actions">
            <button class="ghost" [disabled]="page <= 1" (click)="prevPage()">Prev</button>
            <span>Page {{ page }} / {{ totalPages }}</span>
            <button class="ghost" [disabled]="page >= totalPages" (click)="nextPage()">Next</button>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
    .card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 12px; margin-bottom: 10px; }
    h2, h3, h4 { margin: 0 0 8px; line-height: 1.2; }
    .note { margin: 4px 0 8px; color: var(--muted); font-size: 0.86rem; }
    .error { margin: 4px 0 8px; color: var(--danger); font-size: 0.86rem; }
    .error-banner {
      margin: 6px 0 10px;
      padding: 8px 10px;
      border-radius: 10px;
      border: 1px solid #ef4444;
      background: #fff1f2;
      color: #9f1239;
      font-size: 0.88rem;
    }
    .success { margin: 4px 0 8px; color: #1b7b53; font-size: 0.86rem; }
    input { padding: 6px 8px; border: 1px solid var(--line); border-radius: 8px; }
    button { border: 0; background: var(--brand); color: #fff; border-radius: 8px; padding: 6px 9px; cursor: pointer; white-space: nowrap; }
    button.ghost { border: 1px solid var(--line); background: transparent; color: inherit; }
    button.danger { background: var(--danger); }
    button:disabled { opacity: 0.65; cursor: not-allowed; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid var(--line); padding: 7px 8px; text-align: left; font-size: 0.86rem; vertical-align: middle; }
    tr.selected { background: #f3f9f8; }
    .manage-head { display: flex; justify-content: space-between; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
    .view-switch { display: flex; gap: 6px; }
    .view-switch button.active { background: var(--brand); color: #fff; border-color: var(--brand); }
    .actions { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
    .year-create { display: grid; grid-template-columns: repeat(3, minmax(160px, 1fr)); gap: 6px; margin-bottom: 8px; }
    .upload-grid { display: grid; grid-template-columns: repeat(2, minmax(240px, 1fr)); gap: 8px; margin-bottom: 8px; }
    .upload-box { border: 1px solid var(--line); border-radius: 10px; padding: 10px; background: var(--surface-2); display: grid; gap: 6px; }
    .preview-box { border: 1px dashed #9db7b0; border-radius: 10px; padding: 10px; background: #f4faf8; display: grid; gap: 6px; margin-bottom: 8px; }
    .preview-table { width: 100%; border-collapse: collapse; background: var(--surface); border-radius: 8px; overflow: hidden; }
    .preview-table th, .preview-table td { border-bottom: 1px solid var(--line); padding: 6px 8px; font-size: 0.82rem; text-align: left; }
    .person-row { display: grid; grid-template-columns: 1fr 1.3fr auto; gap: 6px; align-items: center; }
    .file-field { display: grid; gap: 4px; font-size: 0.84rem; color: var(--muted); }
    .file-field small { color: var(--muted); word-break: break-all; }
    .inline-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .toolbar { display: grid; grid-template-columns: minmax(180px, 1fr) auto auto; gap: 6px; margin: 8px 0; }
    .empty { margin: 10px 0; color: var(--muted); }
    .pagination { margin-top: 8px; display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 0.82rem; }
    .pager-actions { display: flex; align-items: center; gap: 6px; }
    .compact-table th, .compact-table td { padding: 6px 8px; font-size: 0.84rem; }
    .compact-table td.file-name { max-width: 360px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .compact-table td .ghost, .compact-table td .danger { padding: 5px 8px; font-size: 0.8rem; }
    .compact-table .actions { gap: 4px; }
    @media (max-width: 1100px) {
      .manage-head { align-items: flex-start; }
      .view-switch { width: 100%; }
      .view-switch button { flex: 1; text-align: center; }
      .year-create { grid-template-columns: 1fr; }
      .upload-grid { grid-template-columns: 1fr; }
      .person-row { grid-template-columns: 1fr; }
      .toolbar { grid-template-columns: 1fr; }
      .pagination { flex-direction: column; align-items: flex-start; }
      .compact-table td.file-name { max-width: 220px; }
    }
    `
  ]
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
  requiresHospcodeInput = false;
  scopeHospcodes: string[] = [];

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

  errorMessage = '';
  successMessage = '';

  constructor(
    private readonly taxService: TaxService,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    const user = this.authService.currentUser;
    this.canManage = this.authService.hasPermission('payroll.export');
    this.isSuperAdmin = user?.roles?.includes('super_admin') ?? false;
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

  get selectedYearShortPreview(): string {
    const yearBe = this.normalizeYearBe(this.createYearForm.yearBe);
    if (yearBe === null) return 'YY';
    return String(yearBe % 100).padStart(2, '0');
  }

  get yearTotal(): number {
    return this.years.length;
  }

  get yearTotalPages(): number {
    return this.yearTotal > 0 ? Math.ceil(this.yearTotal / this.yearPageSize) : 1;
  }

  get yearStartItem(): number {
    if (!this.yearTotal) return 0;
    return (this.yearPage - 1) * this.yearPageSize + 1;
  }

  get yearEndItem(): number {
    return Math.min(this.yearPage * this.yearPageSize, this.yearTotal);
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

  get individualPreviewStartItem(): number {
    if (!this.individualPreviewTotal) return 0;
    return (this.individualPreviewPage - 1) * this.individualPreviewPageSize + 1;
  }

  get individualPreviewEndItem(): number {
    return Math.min(this.individualPreviewPage * this.individualPreviewPageSize, this.individualPreviewTotal);
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

  get batchPreviewStartItem(): number {
    if (!this.batchPreviewTotal) return 0;
    return (this.batchPreviewPage - 1) * this.batchPreviewPageSize + 1;
  }

  get batchPreviewEndItem(): number {
    return Math.min(this.batchPreviewPage * this.batchPreviewPageSize, this.batchPreviewTotal);
  }

  get pagedBatchPreviewItems(): BatchUploadPreviewRow[] {
    const start = (this.batchPreviewPage - 1) * this.batchPreviewPageSize;
    return this.batchPreviewItems.slice(start, start + this.batchPreviewPageSize);
  }

  get totalPages(): number {
    return this.total > 0 ? Math.ceil(this.total / this.pageSize) : 1;
  }

  get startItem(): number {
    if (!this.total) return 0;
    return (this.page - 1) * this.pageSize + 1;
  }

  get endItem(): number {
    return Math.min(this.page * this.pageSize, this.total);
  }

  loadYears(): void {
      this.taxService.listYears().subscribe({
      next: (res) => {
        this.years = res.data || [];
        if (this.yearPage > this.yearTotalPages) {
          this.yearPage = this.yearTotalPages;
        }

        if (!this.years.length) {
          this.selectedYearId = null;
          this.documents = [];
          this.total = 0;
          this.clearUploadPreview(true);
          return;
        }

        if (!this.selectedYearId || !this.years.some((item) => item.id === this.selectedYearId)) {
          this.selectedYearId = this.years[0].id;
          this.page = 1;
        }

        this.ensureSelectedYearVisible();
        this.loadDocuments();
      },
      error: (error) => this.handleApiError(error, 'LOAD_TAX_YEARS_FAILED')
    });
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
          this.createYearForm.yearBe = '';
          this.loadYears();
        },
        error: (error) => this.handleApiError(error, 'CREATE_TAX_YEAR_FAILED')
      });
  }

  deleteYear(year: TaxYearRow): void {
    this.clearMessages();
    const confirmed = window.confirm(`ยืนยันลบปี พ.ศ. ${year.yearBe} และรายการไฟล์ทั้งหมดในปีนี้?`);
    if (!confirmed) return;

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
    this.clearUploadPreview(true);
    this.selectedYearId = yearId;
    this.activeManageView = 'documents';
    this.ensureSelectedYearVisible();
    this.page = 1;
    this.loadDocuments();
  }

  setManageView(view: ManageViewMode): void {
    this.activeManageView = view;
  }

  prevYearPage(): void {
    if (this.yearPage <= 1) return;
    this.yearPage -= 1;
  }

  nextYearPage(): void {
    if (this.yearPage >= this.yearTotalPages) return;
    this.yearPage += 1;
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
          this.successMessage = `เพิ่มแบบรายบุคคลสำเร็จ ${res.data?.createdCount ?? 0} รายการ`;
          this.individualRows = [{ cid: '', file: null }];
          this.page = 1;
          this.activeManageView = 'documents';
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
        this.successMessage = `เพิ่มแบบชุดสำเร็จ ${createdCount} รายการ`;
        this.batchPdfFile = null;
        this.batchTxtFile = null;
        this.page = 1;
        this.activeManageView = 'documents';
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

  prevIndividualPreviewPage(): void {
    if (this.individualPreviewPage <= 1) return;
    this.individualPreviewPage -= 1;
  }

  nextIndividualPreviewPage(): void {
    if (this.individualPreviewPage >= this.individualPreviewTotalPages) return;
    this.individualPreviewPage += 1;
  }

  prevBatchPreviewPage(): void {
    if (this.batchPreviewPage <= 1) return;
    this.batchPreviewPage -= 1;
  }

  nextBatchPreviewPage(): void {
    if (this.batchPreviewPage >= this.batchPreviewTotalPages) return;
    this.batchPreviewPage += 1;
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

  loadDocuments(): void {
    if (!this.selectedYearId) return;

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
          if (this.page > this.totalPages) {
            this.page = this.totalPages;
            this.loadDocuments();
          }
        },
        error: (error) => this.handleApiError(error, 'LOAD_TAX_DOCUMENTS_FAILED')
      });
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

  prevPage(): void {
    if (this.page <= 1) return;
    this.page -= 1;
    this.loadDocuments();
  }

  nextPage(): void {
    if (this.page >= this.totalPages) return;
    this.page += 1;
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
    const confirmed = window.confirm(`ยืนยันลบไฟล์ ${row.file_name}?`);
    if (!confirmed) return;

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
    const blob = new Blob([pageBytes], { type: 'application/pdf' });
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
    if (this.errorMessage) {
      window.alert(this.errorMessage);
    }
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
      HOSPCODE_NOT_FOUND: 'ไม่พบ Hospcode นี้ในตารางหน่วยงาน (organizations)',
      TAX_YEAR_NOT_FOUND: 'ไม่พบปี พ.ศ. ที่เลือก',
      TAX_DOCUMENT_NOT_FOUND: 'ไม่พบรายการไฟล์',
      SCOPE_FORBIDDEN: 'ไม่มีสิทธิ์เข้าถึงข้อมูลหน่วยงานนี้',
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
