import { Component, OnInit } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { MymophUserRow, MymophUsersService } from './mymoph-users.service';

@Component({
  selector: 'app-mymoph-users-management',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule],
  template: `
    <section class="card">
      <header class="page-head">
        <div>
          <h2>User MyMOPH</h2>
          <p class="note">ค้นหาบัญชีด้วยเลขบัตรประชาชนหรืออีเมล ข้อมูล CID จะแสดงแบบปิดหลักที่ 9–12</p>
        </div>
        <div class="privacy-mark">ข้อมูลส่วนบุคคล</div>
      </header>

      <div class="toolbar">
        <input
          [(ngModel)]="search"
          maxlength="100"
          placeholder="เลขบัตรประชาชน หรืออีเมล"
          (keyup.enter)="searchSubmit()"
        />
        <select [(ngModel)]="pageSize" (ngModelChange)="onPageSizeChange()">
          <option *ngFor="let size of pageSizeOptions" [ngValue]="size">{{ size }} / page</option>
        </select>
        <button [disabled]="loading" (click)="searchSubmit()">{{ loading ? 'กำลังค้นหา...' : 'ค้นหา' }}</button>
        <button class="ghost" [disabled]="loading" (click)="clearSearch()">ล้าง</button>
      </div>

      <p class="message error" *ngIf="errorMessage">{{ errorMessage }}</p>
      <p class="message success" *ngIf="successMessage">{{ successMessage }}</p>

      <div class="table-wrap" *ngIf="rows.length; else emptyState">
        <table>
          <thead>
            <tr>
              <th>CID</th>
              <th>ชื่อ</th>
              <th>อีเมล</th>
              <th>KYC</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of rows">
              <td class="mono">{{ row.cidMasked || '-' }}</td>
              <td>{{ displayName(row) }}</td>
              <td>{{ row.email || '-' }}</td>
              <td>
                <span class="status" [class.verified]="row.isKyc === 'Y'">
                  {{ kycLabel(row.isKyc) }}
                </span>
              </td>
              <td class="actions">
                <button
                  *ngIf="canVerifyHr"
                  class="ghost"
                  [disabled]="actionId === row.id"
                  (click)="verifyHr(row)"
                >
                  ตรวจสอบกับ บค.
                </button>
                <button
                  *ngIf="canDelete"
                  class="danger"
                  [disabled]="actionId === row.id"
                  (click)="openDelete(row)"
                >
                  ลบข้อมูล
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ng-template #emptyState>
        <div class="empty">
          <strong>{{ searched ? 'ไม่พบข้อมูล' : 'เริ่มต้นด้วยการค้นหา' }}</strong>
          <span>{{ searched ? 'ลองตรวจสอบ CID หรืออีเมลอีกครั้ง' : 'ระบบจะไม่โหลดข้อมูลทั้งหมดโดยอัตโนมัติ' }}</span>
        </div>
      </ng-template>

      <div class="pagination" *ngIf="total > 0">
        <span>แสดง {{ startItem }}–{{ endItem }} จาก {{ total }} รายการ</span>
        <div class="pager-actions">
          <button class="ghost" [disabled]="page <= 1 || loading" (click)="prevPage()">ก่อนหน้า</button>
          <span>หน้า {{ page }} / {{ totalPages }}</span>
          <button class="ghost" [disabled]="page >= totalPages || loading" (click)="nextPage()">ถัดไป</button>
        </div>
      </div>
    </section>

    <div class="modal-backdrop" *ngIf="deleteTarget">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
        <p class="eyebrow danger-text">ARCHIVE & DELETE</p>
        <h3 id="delete-title">ลบข้อมูล User MyMOPH</h3>
        <p class="note">ข้อมูลเดิมจะถูกเก็บใน collection users_remove ก่อนลบ</p>
        <dl>
          <dt>CID</dt><dd>{{ deleteTarget.cidMasked || '-' }}</dd>
          <dt>อีเมล</dt><dd>{{ deleteTarget.email || '-' }}</dd>
        </dl>
        <label>
          <span>เหตุผลในการลบ</span>
          <textarea [(ngModel)]="deleteReason" maxlength="500" rows="4" placeholder="ระบุเหตุผลอย่างน้อย 5 ตัวอักษร"></textarea>
        </label>
        <p class="message error" *ngIf="deleteError">{{ deleteError }}</p>
        <div class="modal-actions">
          <button class="ghost" [disabled]="deleting" (click)="closeDelete()">ยกเลิก</button>
          <button class="danger" [disabled]="deleting" (click)="confirmDelete()">
            {{ deleting ? 'กำลังลบ...' : 'ยืนยันลบข้อมูล' }}
          </button>
        </div>
      </section>
    </div>
  `,
  styles: [
    `
    .card { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 18px; }
    .page-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 16px; }
    h2, h3 { margin: 0; }
    .eyebrow { margin: 0 0 4px; color: var(--brand-strong); font-size: .72rem; font-weight: 800; letter-spacing: .12em; }
    .note { margin: 6px 0 0; color: var(--muted); font-size: .9rem; }
    .privacy-mark { padding: 7px 10px; border: 1px solid #e0b96d; border-radius: 999px; background: #fff8e8; color: #805b18; font-size: .78rem; font-weight: 700; }
    .toolbar { display: grid; grid-template-columns: minmax(260px, 1fr) 120px auto auto; gap: 8px; margin-bottom: 14px; }
    input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--line); border-radius: 9px; padding: 9px 10px; background: var(--surface); color: inherit; }
    textarea { resize: vertical; margin-top: 6px; }
    button { border: 0; border-radius: 9px; padding: 8px 11px; background: var(--brand); color: #fff; cursor: pointer; white-space: nowrap; }
    button.ghost { border: 1px solid var(--line); background: transparent; color: inherit; }
    button.danger { background: var(--danger); }
    button:disabled { opacity: .55; cursor: not-allowed; }
    .message { margin: 8px 0; padding: 9px 11px; border-radius: 9px; font-size: .88rem; }
    .error { background: #fff1f2; color: #9f1239; }
    .success { background: #ecfdf5; color: #166534; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid var(--line); padding: 10px 8px; text-align: left; font-size: .88rem; vertical-align: middle; }
    th { color: var(--muted); font-size: .78rem; letter-spacing: .04em; text-transform: uppercase; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .status { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #f1f5f9; color: #475569; font-size: .78rem; font-weight: 700; }
    .status.verified { background: #dcfce7; color: #166534; }
    .actions { display: flex; justify-content: flex-end; gap: 6px; }
    .empty { display: grid; place-items: center; gap: 5px; min-height: 180px; color: var(--muted); text-align: center; border: 1px dashed var(--line); border-radius: 12px; }
    .pagination { margin-top: 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: .84rem; }
    .pager-actions, .modal-actions { display: flex; align-items: center; gap: 8px; }
    .modal-backdrop { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 18px; background: rgba(7, 24, 28, .56); }
    .modal { width: min(520px, 100%); background: var(--surface); border-radius: 16px; padding: 20px; box-shadow: 0 24px 70px rgba(0, 0, 0, .3); }
    .modal dl { display: grid; grid-template-columns: 80px 1fr; gap: 7px; padding: 12px; background: var(--surface-2); border-radius: 10px; }
    .modal dt { color: var(--muted); }
    .modal dd { margin: 0; overflow-wrap: anywhere; }
    .modal label span { display: block; font-size: .86rem; font-weight: 700; }
    .modal-actions { justify-content: flex-end; margin-top: 14px; }
    .danger-text { color: var(--danger); }
    @media (max-width: 900px) {
      .page-head { flex-direction: column; }
      .toolbar { grid-template-columns: 1fr; }
      .actions { flex-direction: column; align-items: stretch; }
      .pagination { flex-direction: column; align-items: flex-start; }
    }
    `
  ]
})
export class MymophUsersManagementComponent implements OnInit {
  readonly pageSizeOptions = [10, 20, 50];

  search = '';
  appliedSearch = '';
  page = 1;
  pageSize = 20;
  total = 0;
  rows: MymophUserRow[] = [];
  loading = false;
  searched = false;
  actionId = '';

  canVerifyHr = false;
  canDelete = false;
  errorMessage = '';
  successMessage = '';

  deleteTarget: MymophUserRow | null = null;
  deleteReason = '';
  deleteError = '';
  deleting = false;

  constructor(
    private readonly mymophUsersService: MymophUsersService,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.canVerifyHr = this.authService.hasPermission('mymoph_user.verify_hr');
    this.canDelete = this.authService.hasPermission('mymoph_user.delete');
  }

  get totalPages(): number {
    return this.total > 0 ? Math.ceil(this.total / this.pageSize) : 1;
  }

  get startItem(): number {
    return this.total ? ((this.page - 1) * this.pageSize) + 1 : 0;
  }

  get endItem(): number {
    return Math.min(this.page * this.pageSize, this.total);
  }

  searchSubmit(): void {
    const search = this.search.trim();
    this.clearMessages();
    if (search.length < 3) {
      this.errorMessage = 'กรุณาระบุเลขบัตรหรืออีเมลอย่างน้อย 3 ตัวอักษร';
      return;
    }

    this.appliedSearch = search;
    this.page = 1;
    this.load();
  }

  clearSearch(): void {
    this.search = '';
    this.appliedSearch = '';
    this.rows = [];
    this.total = 0;
    this.page = 1;
    this.searched = false;
    this.clearMessages();
  }

  onPageSizeChange(): void {
    this.page = 1;
    if (this.appliedSearch) this.load();
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

  verifyHr(row: MymophUserRow): void {
    this.clearMessages();
    this.actionId = row.id;
    this.mymophUsersService.verifyHr(row.id).subscribe({
      next: (res) => {
        this.actionId = '';
        this.successMessage = res.data?.found ? 'พบข้อมูลในฐานบุคลากร' : 'ไม่พบข้อมูลในฐานบุคลากร';
      },
      error: (error) => {
        this.actionId = '';
        this.errorMessage = this.resolveError(error, 'ตรวจสอบฐานบุคลากรไม่สำเร็จ');
      }
    });
  }

  openDelete(row: MymophUserRow): void {
    this.deleteTarget = row;
    this.deleteReason = '';
    this.deleteError = '';
  }

  closeDelete(): void {
    if (this.deleting) return;
    this.deleteTarget = null;
    this.deleteReason = '';
    this.deleteError = '';
  }

  confirmDelete(): void {
    if (!this.deleteTarget) return;
    const reason = this.deleteReason.trim();
    if (reason.length < 5) {
      this.deleteError = 'กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร';
      return;
    }

    this.deleting = true;
    this.deleteError = '';
    this.mymophUsersService.archiveDelete(this.deleteTarget.id, reason).subscribe({
      next: () => {
        this.deleting = false;
        this.closeDelete();
        this.load();
        this.successMessage = 'จัดเก็บประวัติและลบข้อมูลเรียบร้อยแล้ว';
      },
      error: (error) => {
        this.deleting = false;
        this.deleteError = this.resolveError(error, 'ลบข้อมูลไม่สำเร็จ');
      }
    });
  }

  displayName(row: MymophUserRow): string {
    return `${row.firstName} ${row.lastName}`.trim() || '-';
  }

  kycLabel(status: MymophUserRow['isKyc']): string {
    if (status === 'Y') return 'ยืนยันตัวตนแล้ว';
    if (status === 'N') return 'ยังไม่ได้ยืนยัน';
    return 'ไม่ทราบสถานะ';
  }

  private load(): void {
    if (!this.appliedSearch) return;
    this.loading = true;
    this.clearMessages();
    this.mymophUsersService.list({
      search: this.appliedSearch,
      page: this.page,
      pageSize: this.pageSize
    }).subscribe({
      next: (res) => {
        this.loading = false;
        this.searched = true;
        this.rows = res.data?.rows || [];
        this.total = Number(res.data?.total || 0);
        if (this.page > this.totalPages) {
          this.page = this.totalPages;
          this.load();
        }
      },
      error: (error) => {
        this.loading = false;
        this.searched = true;
        this.rows = [];
        this.total = 0;
        this.errorMessage = this.resolveError(error, 'ค้นหาข้อมูลไม่สำเร็จ');
      }
    });
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  private resolveError(error: any, fallback: string): string {
    const code = error?.error?.error;
    const messages: Record<string, string> = {
      FORBIDDEN: 'ไม่มีสิทธิ์ใช้งานส่วนนี้',
      GLOBAL_SCOPE_REQUIRED: 'โมดูลนี้อนุญาตเฉพาะผู้ดูแลระบบส่วนกลาง',
      MYMOPH_USER_NOT_FOUND: 'ไม่พบข้อมูลผู้ใช้ MyMOPH',
      MYMOPH_USER_INVALID_CID: 'CID ของผู้ใช้ไม่ถูกต้อง',
      HR_STATUS_SERVICE_UNAVAILABLE: 'ระบบตรวจสอบฐานบุคลากรไม่พร้อมใช้งาน',
      MYMOPH_USER_DELETE_CONFLICT: 'ข้อมูลถูกเปลี่ยนแปลงระหว่างการลบ กรุณาค้นหาใหม่',
      MYMOPH_MONGO_UNAVAILABLE: 'ฐานข้อมูล User MyMOPH ไม่พร้อมใช้งาน',
      INVALID_SEARCH: 'กรุณาระบุเลขบัตรหรืออีเมลอย่างน้อย 3 ตัวอักษร',
      INVALID_DELETE_REASON: 'กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร'
    };
    return messages[String(code)] || fallback;
  }
}
