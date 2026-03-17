import { Component, OnInit } from '@angular/core';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { PersonnelRow, PersonnelService } from './personnel.service';

@Component({
  selector: 'app-personnel-management',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, DatePipe],
  template: `
    <section class="card">
      <h2>ข้อมูลบุคลากร</h2>
      <p class="note">ใช้สำหรับอ้างอิงในการออกรายงานต่างๆ</p>

      <div class="toolbar">
        <input [(ngModel)]="search" placeholder="ค้นหาเลขบัตร/ชื่อ/นามสกุล" />
        <select [(ngModel)]="pageSize" (ngModelChange)="onPageSizeChange()">
          <option *ngFor="let size of pageSizeOptions" [ngValue]="size">{{ size }} / page</option>
        </select>
        <button (click)="searchSubmit()">Search</button>
        <button class="ghost" (click)="resetFilters()">Clear</button>
      </div>

      <div class="form-grid" *ngIf="canManage">
        <input [(ngModel)]="createForm.cid" maxlength="13" placeholder="เลขบัตร 13 หลัก" />
        <input [(ngModel)]="createForm.firstName" maxlength="100" placeholder="ชื่อ" />
        <input [(ngModel)]="createForm.lastName" maxlength="100" placeholder="นามสกุล" />
        <input
          *ngIf="isSuperAdmin"
          [(ngModel)]="createForm.hospcode"
          maxlength="10"
          placeholder="Hospcode"
        />
        <select *ngIf="!isSuperAdmin && scopeHospcodes.length > 1" [(ngModel)]="createForm.hospcode">
          <option *ngFor="let hospcode of scopeHospcodes" [ngValue]="hospcode">{{ hospcode }}</option>
        </select>
        <div *ngIf="!isSuperAdmin && scopeHospcodes.length <= 1" class="fixed-scope">
          Hospcode: {{ defaultHospcode || '-' }}
        </div>
        <button (click)="create()">เพิ่มข้อมูล</button>
      </div>

      <section class="upload-card" *ngIf="canManage">
        <h3>Upload Excel</h3>
        <div class="upload-controls">
          <button class="ghost" (click)="downloadTemplate()">ดาวน์โหลด Template</button>
          <input type="file" accept=".xlsx" (change)="onFileSelected($event)" />
          <button [disabled]="!selectedFile || uploading" (click)="uploadExcel()">
            {{ uploading ? 'กำลังอัปโหลด...' : 'Upload Excel' }}
          </button>
        </div>
        <p class="note" *ngIf="uploadSummary">{{ uploadSummary }}</p>
        <p class="error" *ngIf="uploadError">{{ uploadError }}</p>
      </section>

      <p class="note" *ngIf="!canManage">บัญชีนี้เป็นโหมดอ่านอย่างเดียว (ไม่มีสิทธิ์ personnel.manage)</p>
      <p class="error" *ngIf="errorMessage">{{ errorMessage }}</p>

      <table *ngIf="rows.length; else emptyState">
        <thead>
          <tr>
            <th>เลขบัตร</th>
            <th>ชื่อ</th>
            <th>นามสกุล</th>
            <th *ngIf="showHospcodeColumn">Hospcode</th>
            <th>Updated</th>
            <th *ngIf="canManage"></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let row of rows">
            <td *ngIf="editId !== row.id">{{ row.cid }}</td>
            <td *ngIf="editId === row.id">
              <input [(ngModel)]="editForm.cid" maxlength="13" placeholder="เลขบัตร" />
            </td>

            <td *ngIf="editId !== row.id">{{ row.first_name }}</td>
            <td *ngIf="editId === row.id">
              <input [(ngModel)]="editForm.firstName" maxlength="100" placeholder="ชื่อ" />
            </td>

            <td *ngIf="editId !== row.id">{{ row.last_name }}</td>
            <td *ngIf="editId === row.id">
              <input [(ngModel)]="editForm.lastName" maxlength="100" placeholder="นามสกุล" />
            </td>

            <td *ngIf="showHospcodeColumn && editId !== row.id">{{ row.hospcode }}</td>
            <td *ngIf="showHospcodeColumn && editId === row.id">
              <input
                *ngIf="isSuperAdmin"
                [(ngModel)]="editForm.hospcode"
                maxlength="10"
                placeholder="Hospcode"
              />
              <select *ngIf="!isSuperAdmin" [(ngModel)]="editForm.hospcode">
                <option *ngFor="let hospcode of scopeHospcodes" [ngValue]="hospcode">{{ hospcode }}</option>
              </select>
            </td>

            <td>{{ row.updated_at | date:'dd MMM yyyy HH:mm':'Asia/Bangkok':'th-TH' }}</td>

            <td *ngIf="canManage" class="actions">
              <ng-container *ngIf="editId === row.id; else defaultActions">
                <button (click)="saveEdit(row.id)">Save</button>
                <button class="ghost" (click)="cancelEdit()">Cancel</button>
              </ng-container>

              <ng-template #defaultActions>
                <button class="ghost" (click)="startEdit(row)">Edit</button>
                <button class="danger" (click)="remove(row.id)">Delete</button>
              </ng-template>
            </td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p class="empty">ไม่พบข้อมูลบุคลากร</p>
      </ng-template>

      <div class="pagination" *ngIf="total > 0">
        <span>Showing {{ startItem }}-{{ endItem }} of {{ total }}</span>
        <div class="pager-actions">
          <button class="ghost" [disabled]="page <= 1" (click)="prevPage()">Prev</button>
          <span>Page {{ page }} / {{ totalPages }}</span>
          <button class="ghost" [disabled]="page >= totalPages" (click)="nextPage()">Next</button>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
    .card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 18px; }
    .note { margin: 6px 0 12px; color: var(--muted); font-size: 0.9rem; }
    .error { margin: 6px 0 12px; color: var(--danger); font-size: 0.9rem; }
    .toolbar, .form-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(120px, 1fr));
      gap: 8px;
      margin-bottom: 12px;
    }
    .upload-card {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 12px;
      background: var(--surface-2);
    }
    .upload-card h3 {
      margin: 0 0 10px;
      font-size: 1rem;
      color: var(--brand-strong);
    }
    .upload-controls {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .fixed-scope {
      display: grid;
      place-items: center start;
      padding: 8px;
      border: 1px dashed var(--line);
      border-radius: 8px;
      color: var(--muted);
      font-size: 0.9rem;
    }
    input, select {
      padding: 8px;
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    button {
      border: 0;
      background: var(--brand);
      color: #fff;
      border-radius: 8px;
      padding: 8px 10px;
      cursor: pointer;
      white-space: nowrap;
    }
    button.ghost {
      border: 1px solid var(--line);
      background: transparent;
      color: inherit;
    }
    button.danger { background: var(--danger); }
    button:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid var(--line); padding: 10px 8px; text-align: left; font-size: 0.9rem; vertical-align: middle; }
    .actions { display: flex; gap: 6px; }
    .empty { margin: 14px 0; color: var(--muted); }
    .pagination { margin-top: 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .pager-actions { display: flex; align-items: center; gap: 8px; }

    @media (max-width: 1200px) {
      .toolbar, .form-grid { grid-template-columns: 1fr; }
      .actions { flex-direction: column; }
      .pagination { flex-direction: column; align-items: flex-start; }
      .upload-controls { align-items: flex-start; }
    }
    `
  ]
})
export class PersonnelManagementComponent implements OnInit {
  readonly pageSizeOptions = [10, 20, 50];

  search = '';
  page = 1;
  pageSize = 20;
  total = 0;
  rows: PersonnelRow[] = [];

  canManage = false;
  isSuperAdmin = false;
  scopeHospcodes: string[] = [];
  defaultHospcode = '';
  showHospcodeColumn = false;

  errorMessage = '';

  selectedFile: File | null = null;
  uploadSummary = '';
  uploadError = '';
  uploading = false;

  createForm = {
    cid: '',
    firstName: '',
    lastName: '',
    hospcode: ''
  };

  editId: string | null = null;
  editForm = {
    cid: '',
    firstName: '',
    lastName: '',
    hospcode: ''
  };

  constructor(
    private readonly personnelService: PersonnelService,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    const user = this.authService.currentUser;
    this.canManage = this.authService.hasPermission('personnel.manage');

    if (user) {
      this.isSuperAdmin = user.roles.includes('super_admin');
      this.scopeHospcodes = user.hospcodes || [];
      const hasSingleScope = user.scopeType === 'LIST' && user.hospcodes.length === 1;
      this.defaultHospcode = hasSingleScope ? user.hospcodes[0] : '';
      this.showHospcodeColumn = this.isSuperAdmin || this.scopeHospcodes.length > 1;
      this.createForm.hospcode = this.defaultHospcode || this.scopeHospcodes[0] || '';
    }

    this.load();
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

  load(): void {
    this.errorMessage = '';
    this.personnelService
      .list({
        search: this.search.trim() || undefined,
        page: this.page,
        pageSize: this.pageSize
      })
      .subscribe({
        next: (res) => {
          const data = res.data;
          this.rows = data.rows || [];
          this.total = Number(data.total || 0);
          if (this.page > this.totalPages) {
            this.page = this.totalPages;
            this.load();
          }
        },
        error: (error) => {
          this.handleError(error?.error?.error || 'LOAD_PERSONNEL_FAILED');
        }
      });
  }

  searchSubmit(): void {
    this.page = 1;
    this.load();
  }

  resetFilters(): void {
    this.search = '';
    this.page = 1;
    this.load();
  }

  onPageSizeChange(): void {
    this.page = 1;
    this.load();
  }

  prevPage(): void {
    if (this.page <= 1) return;
    this.page -= 1;
    this.load();
  }

  nextPage(): void {
    if (this.page >= this.totalPages) return;
    this.page += 1;
    this.load();
  }

  create(): void {
    const payload = {
      cid: this.createForm.cid.trim(),
      firstName: this.createForm.firstName.trim(),
      lastName: this.createForm.lastName.trim(),
      hospcode: this.resolveHospcode(this.createForm.hospcode)
    };

    if (!payload.cid || !payload.firstName || !payload.lastName || !payload.hospcode) {
      this.errorMessage = 'กรุณากรอกข้อมูลให้ครบ';
      return;
    }

    this.errorMessage = '';
    this.personnelService.create(payload).subscribe({
      next: () => {
        this.createForm = {
          cid: '',
          firstName: '',
          lastName: '',
          hospcode: this.defaultHospcode
        };
        this.page = 1;
        this.load();
      },
      error: (error) => {
        this.handleError(error?.error?.error || 'CREATE_PERSONNEL_FAILED');
      }
    });
  }

  startEdit(row: PersonnelRow): void {
    this.errorMessage = '';
    this.editId = row.id;
    this.editForm = {
      cid: row.cid,
      firstName: row.first_name,
      lastName: row.last_name,
      hospcode: row.hospcode
    };
  }

  cancelEdit(): void {
    this.editId = null;
    this.editForm = {
      cid: '',
      firstName: '',
      lastName: '',
      hospcode: ''
    };
  }

  saveEdit(id: string): void {
    const payload = {
      cid: this.editForm.cid.trim(),
      firstName: this.editForm.firstName.trim(),
      lastName: this.editForm.lastName.trim(),
      hospcode: this.resolveHospcode(this.editForm.hospcode)
    };

    if (!payload.cid || !payload.firstName || !payload.lastName || !payload.hospcode) {
      this.errorMessage = 'กรุณากรอกข้อมูลให้ครบ';
      return;
    }

    this.errorMessage = '';
    this.personnelService.update(id, payload).subscribe({
      next: () => {
        this.cancelEdit();
        this.load();
      },
      error: (error) => {
        this.handleError(error?.error?.error || 'UPDATE_PERSONNEL_FAILED');
      }
    });
  }

  remove(id: string): void {
    if (!confirm('ยืนยันลบข้อมูลบุคลากร?')) {
      return;
    }

    this.errorMessage = '';
    this.personnelService.remove(id).subscribe({
      next: () => {
        this.load();
      },
      error: (error) => {
        this.handleError(error?.error?.error || 'DELETE_PERSONNEL_FAILED');
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files && input.files.length ? input.files[0] : null;
    this.uploadError = '';
    this.uploadSummary = '';
  }

  downloadTemplate(): void {
    this.personnelService.downloadTemplate().subscribe({
      next: (response) => {
        this.downloadBlob(response.body, this.extractFilename(response.headers.get('content-disposition')) || 'personnel-template.xlsx');
      },
      error: () => {
        this.uploadError = 'ดาวน์โหลด template ไม่สำเร็จ';
      }
    });
  }

  uploadExcel(): void {
    if (!this.selectedFile || this.uploading) {
      return;
    }

    this.uploading = true;
    this.uploadError = '';
    this.uploadSummary = '';

    this.personnelService.uploadExcel(this.selectedFile).subscribe({
      next: (res) => {
        const data = res.data;
        this.uploadSummary = `อัปโหลดสำเร็จ: ประมวลผล ${data.processedCount} รายการ, เพิ่มใหม่ ${data.insertedCount}, อัปเดต ${data.updatedCount}, ผิดพลาด ${data.errorCount}`;
        if (data.errorCount > 0) {
          const firstError = data.errors?.[0];
          if (firstError) {
            this.uploadError = `ตัวอย่างข้อผิดพลาด: แถว ${firstError.rowNumber} - ${firstError.error}`;
          }
        }

        this.selectedFile = null;
        this.uploading = false;
        this.page = 1;
        this.load();
      },
      error: (error) => {
        this.uploading = false;
        this.handleError(error?.error?.error || 'UPLOAD_PERSONNEL_FAILED');
      }
    });
  }

  private resolveHospcode(inputHospcode: string): string {
    const value = inputHospcode.trim();
    if (this.isSuperAdmin) {
      return value;
    }

    if (value && this.scopeHospcodes.includes(value)) {
      return value;
    }

    if (this.defaultHospcode) {
      return this.defaultHospcode;
    }

    return this.scopeHospcodes[0] || '';
  }

  private downloadBlob(blob: Blob | null, fallbackFilename: string): void {
    if (!blob) {
      this.uploadError = 'ไม่พบไฟล์สำหรับดาวน์โหลด';
      return;
    }

    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fallbackFilename;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  private extractFilename(contentDisposition: string | null): string | null {
    if (!contentDisposition) return null;

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1]);
    }

    const simpleMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
    return simpleMatch?.[1] ?? null;
  }

  private handleError(errorCode: string): void {
    const map: Record<string, string> = {
      LOAD_PERSONNEL_FAILED: 'โหลดข้อมูลบุคลากรไม่สำเร็จ',
      CREATE_PERSONNEL_FAILED: 'เพิ่มข้อมูลบุคลากรไม่สำเร็จ',
      UPDATE_PERSONNEL_FAILED: 'อัปเดตข้อมูลบุคลากรไม่สำเร็จ',
      DELETE_PERSONNEL_FAILED: 'ลบข้อมูลบุคลากรไม่สำเร็จ',
      UPLOAD_PERSONNEL_FAILED: 'อัปโหลดข้อมูลบุคลากรไม่สำเร็จ',
      PERSONNEL_NOT_FOUND: 'ไม่พบข้อมูลบุคลากร',
      PERSONNEL_ALREADY_EXISTS: 'ข้อมูลบุคลากรนี้มีอยู่แล้ว',
      INVALID_CID: 'เลขบัตรต้องเป็นตัวเลข 13 หลัก',
      INVALID_NAME: 'ชื่อและนามสกุลต้องไม่ว่าง',
      INVALID_HOSPCODE: 'Hospcode ไม่ถูกต้อง',
      MISSING_HOSPCODE: 'ไฟล์ Excel ต้องระบุ Hospcode',
      INVALID_TEMPLATE_HEADER: 'หัวตาราง Excel ไม่ถูกต้อง',
      NO_DATA_IN_EXCEL: 'ไม่พบข้อมูลในไฟล์ Excel',
      FILE_REQUIRED: 'กรุณาเลือกไฟล์ Excel',
      SCOPE_FORBIDDEN: 'ไม่มีสิทธิ์เข้าถึงหน่วยงานนี้'
    };

    this.errorMessage = map[errorCode] ?? `เกิดข้อผิดพลาด: ${errorCode}`;
  }
}
