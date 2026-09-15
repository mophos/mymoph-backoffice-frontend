import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { OfficeSettingRow, OfficeSettingsService } from './office-settings.service';

type StatusFilter = 'all' | '1' | '0';

@Component({
    selector: 'app-office-settings',
    imports: [FormsModule, DatePipe],
    template: `
    <section class="card">
      <h2>Office Settings</h2>
      <p class="note">จัดการข้อมูลหน่วยงาน/โรงพยาบาลตามสิทธิ์และขอบเขตหน่วยงานของผู้ใช้</p>
    
      <div class="toolbar">
        <input [(ngModel)]="search" placeholder="Search by hospcode, name, province" />
        <select [(ngModel)]="statusFilter">
          <option value="all">All status</option>
          <option value="1">Active</option>
          <option value="0">Inactive</option>
        </select>
        <select [(ngModel)]="pageSize" (ngModelChange)="onPageSizeChange()">
          @for (size of pageSizeOptions; track size) {
            <option [ngValue]="size">{{ size }} / page</option>
          }
        </select>
        <button (click)="searchSubmit()">Search</button>
        <button class="ghost" (click)="resetFilters()">Clear</button>
      </div>
    
      @if (canManage) {
        <div class="form-grid">
          <input [(ngModel)]="createForm.hospcode" maxlength="10" placeholder="Hospcode" />
          <input [(ngModel)]="createForm.name" placeholder="Office name" />
          <input [(ngModel)]="createForm.province_code" maxlength="10" placeholder="Province code" />
          <select [(ngModel)]="createForm.is_active">
            <option [ngValue]="1">Active</option>
            <option [ngValue]="0">Inactive</option>
          </select>
          <button (click)="create()">Add Office</button>
        </div>
      }
    
      @if (!canManage) {
        <p class="note">บัญชีนี้เป็นโหมดอ่านอย่างเดียว (ไม่มีสิทธิ์ office_settings.update)</p>
      }
      @if (errorMessage) {
        <p class="error">{{ errorMessage }}</p>
      }
    
      @if (rows.length) {
        <table>
          <thead>
            <tr>
              <th>Hospcode</th>
              <th>Name</th>
              <th>Province</th>
              <th>Status</th>
              <th>Checkin-Checkout</th>
              <th>Updated</th>
              @if (canManage) {
                <th></th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of rows; track row) {
              <tr>
                <td>{{ row.hospcode }}</td>
                @if (editHospcode !== row.hospcode) {
                  <td>{{ row.name }}</td>
                }
                @if (editHospcode === row.hospcode) {
                  <td>
                    <input [(ngModel)]="editForm.name" placeholder="Office name" />
                  </td>
                }
                @if (editHospcode !== row.hospcode) {
                  <td>{{ row.province_code || '-' }}</td>
                }
                @if (editHospcode === row.hospcode) {
                  <td>
                    <input [(ngModel)]="editForm.province_code" maxlength="10" placeholder="Province code" />
                  </td>
                }
                @if (editHospcode !== row.hospcode) {
                  <td>
                    <span [class.inactive]="row.is_active === 0">
                      {{ row.is_active === 1 ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                }
                @if (editHospcode === row.hospcode) {
                  <td>
                    <select [(ngModel)]="editForm.is_active">
                      <option [ngValue]="1">Active</option>
                      <option [ngValue]="0">Inactive</option>
                    </select>
                  </td>
                }
                <td>
                  <div class="checkin-cell">
                    @if (canManage) {
                      <button
                        [disabled]="row.is_checkin_registered === 1 || registeringHospcode === row.hospcode"
                        (click)="registerCheckinOffice(row)"
                        >
                        {{ registeringHospcode === row.hospcode ? 'กำลังบันทึก...' : row.is_checkin_registered === 1 ? 'ลงทะเบียนแล้ว' : 'ลงทะเบียน' }}
                      </button>
                    }
                  </div>
                </td>
                <td>{{ row.updated_at | date:'dd MMM yyyy HH:mm':'Asia/Bangkok':'th-TH' }}</td>
                @if (canManage) {
                  <td class="actions">
                    @if (editHospcode === row.hospcode) {
                      <button (click)="saveEdit(row.hospcode)">Save</button>
                      <button class="ghost" (click)="cancelEdit()">Cancel</button>
                    } @else {
                      <button class="ghost" (click)="startEdit(row)">Edit</button>
                      <button class="danger" (click)="remove(row.hospcode)">Deactivate</button>
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <p class="empty">ไม่พบข้อมูลหน่วยงาน</p>
      }
    
    
      @if (total > 0) {
        <div class="pagination">
          <span>Showing {{ startItem }}-{{ endItem }} of {{ total }}</span>
          <div class="pager-actions">
            <button class="ghost" [disabled]="page <= 1" (click)="prevPage()">Prev</button>
            <span>Page {{ page }} / {{ totalPages }}</span>
            <button class="ghost" [disabled]="page >= totalPages" (click)="nextPage()">Next</button>
          </div>
        </div>
      }
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
    .form-grid { grid-template-columns: repeat(5, minmax(120px, 1fr)); }
    input, select { padding: 8px; border: 1px solid var(--line); border-radius: 8px; }
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
    .inactive { color: var(--muted); }
    .actions { display: flex; gap: 6px; }
    .checkin-cell { display: flex; align-items: center; }
    .empty { margin: 14px 0; color: var(--muted); }
    .pagination { margin-top: 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .pager-actions { display: flex; align-items: center; gap: 8px; }
    @media (max-width: 1200px) {
      .toolbar, .form-grid { grid-template-columns: 1fr; }
      .actions { flex-direction: column; }
      .pagination { flex-direction: column; align-items: flex-start; }
    }
    `
    ]
})
export class OfficeSettingsComponent implements OnInit {
  readonly pageSizeOptions = [10, 20, 50];

  search = '';
  statusFilter: StatusFilter = 'all';
  page = 1;
  pageSize = 20;
  total = 0;
  rows: OfficeSettingRow[] = [];
  canManage = false;
  errorMessage = '';
  registeringHospcode: string | null = null;

  createForm: {
    hospcode: string;
    name: string;
    province_code: string;
    is_active: 0 | 1;
  } = {
    hospcode: '',
    name: '',
    province_code: '',
    is_active: 1
  };

  editHospcode: string | null = null;
  editForm: {
    name: string;
    province_code: string;
    is_active: 0 | 1;
  } = {
    name: '',
    province_code: '',
    is_active: 1
  };

  constructor(
    private readonly officeSettingsService: OfficeSettingsService,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.canManage = this.authService.hasPermission('office_settings.update');
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
    this.officeSettingsService
      .list({
        search: this.search.trim() || undefined,
        isActive: this.statusFilter,
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
          this.handleError(error?.error?.error || 'LOAD_OFFICE_SETTINGS_FAILED');
        }
      });
  }

  searchSubmit(): void {
    this.page = 1;
    this.load();
  }

  resetFilters(): void {
    this.search = '';
    this.statusFilter = 'all';
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
    const hospcode = this.createForm.hospcode.trim();
    const name = this.createForm.name.trim();

    if (!hospcode || !name) {
      this.errorMessage = 'กรุณากรอก Hospcode และชื่อหน่วยงานให้ครบ';
      return;
    }

    this.errorMessage = '';
    this.officeSettingsService
      .create({
        hospcode,
        name,
        province_code: this.normalizeNullable(this.createForm.province_code),
        is_active: this.createForm.is_active
      })
      .subscribe({
        next: () => {
          this.createForm = {
            hospcode: '',
            name: '',
            province_code: '',
            is_active: 1
          };
          this.page = 1;
          this.load();
        },
        error: (error) => {
          this.handleError(error?.error?.error || 'CREATE_OFFICE_FAILED');
        }
      });
  }

  startEdit(row: OfficeSettingRow): void {
    this.errorMessage = '';
    this.editHospcode = row.hospcode;
    this.editForm = {
      name: row.name,
      province_code: row.province_code ?? '',
      is_active: row.is_active === 0 ? 0 : 1
    };
  }

  cancelEdit(): void {
    this.editHospcode = null;
    this.editForm = {
      name: '',
      province_code: '',
      is_active: 1
    };
  }

  saveEdit(hospcode: string): void {
    const name = this.editForm.name.trim();
    if (!name) {
      this.errorMessage = 'ชื่อหน่วยงานต้องไม่ว่าง';
      return;
    }

    this.errorMessage = '';
    this.officeSettingsService
      .update(hospcode, {
        name,
        province_code: this.normalizeNullable(this.editForm.province_code),
        is_active: this.editForm.is_active
      })
      .subscribe({
        next: () => {
          this.cancelEdit();
          this.load();
        },
        error: (error) => {
          this.handleError(error?.error?.error || 'UPDATE_OFFICE_FAILED');
        }
      });
  }

  remove(hospcode: string): void {
    if (!confirm(`ยืนยันปิดการใช้งานหน่วยงาน ${hospcode} ?`)) {
      return;
    }

    this.errorMessage = '';
    this.officeSettingsService.remove(hospcode).subscribe({
      next: () => {
        this.load();
      },
      error: (error) => {
        this.handleError(error?.error?.error || 'DELETE_OFFICE_FAILED');
      }
    });
  }

  registerCheckinOffice(row: OfficeSettingRow): void {
    if (row.is_checkin_registered === 1 || this.registeringHospcode) {
      return;
    }

    if (!confirm(`ยืนยันเปิดใช้งาน checkin-checkout สำหรับหน่วยงาน ${row.hospcode} ?`)) {
      return;
    }

    this.errorMessage = '';
    this.registeringHospcode = row.hospcode;
    this.officeSettingsService.registerCheckinOffice(row.hospcode).subscribe({
      next: () => {
        this.registeringHospcode = null;
        this.load();
      },
      error: (error) => {
        this.registeringHospcode = null;
        this.handleError(error?.error?.error || 'REGISTER_CHECKIN_OFFICE_FAILED');
      }
    });
  }

  private normalizeNullable(value: string): string | null {
    const normalized = value.trim();
    return normalized || null;
  }

  private handleError(errorCode: string): void {
    const map: Record<string, string> = {
      HOSPCODE_ALREADY_EXISTS: 'Hospcode นี้มีอยู่แล้วในระบบ',
      ORGANIZATION_NOT_FOUND: 'ไม่พบข้อมูลหน่วยงาน',
      SCOPE_FORBIDDEN: 'ไม่มีสิทธิ์จัดการหน่วยงานนี้',
      LOAD_OFFICE_SETTINGS_FAILED: 'โหลดข้อมูล Office Settings ไม่สำเร็จ',
      CREATE_OFFICE_FAILED: 'เพิ่มหน่วยงานไม่สำเร็จ',
      UPDATE_OFFICE_FAILED: 'อัปเดตหน่วยงานไม่สำเร็จ',
      DELETE_OFFICE_FAILED: 'ปิดการใช้งานหน่วยงานไม่สำเร็จ',
      CHECKIN_OFFICE_TABLE_NOT_FOUND: 'ไม่พบตาราง checkin_offices ในฐานข้อมูล mymoph',
      CHECKIN_OFFICE_TABLE_INVALID: 'โครงสร้างตาราง checkin_offices ไม่รองรับการลงทะเบียน',
      REGISTER_CHECKIN_OFFICE_FAILED: 'เปิดใช้งาน checkin-checkout ไม่สำเร็จ'
    };

    this.errorMessage = map[errorCode] ?? `เกิดข้อผิดพลาด: ${errorCode}`;
  }
}
