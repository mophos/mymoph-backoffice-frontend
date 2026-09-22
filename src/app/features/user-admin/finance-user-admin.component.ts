import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../core/auth/auth.service';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { DataTableComponent, DataTableColumn } from '../../shared/ui/data-table/data-table.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { FinanceAdminService } from '../hr-admin/finance-admin.service';

interface AdminRow {
  user_id: string;
  cid: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  role_codes: string[];
  hospcodes: string[];
}

const FINANCE_ROLE = 'admin_affairs';

/** ข้อความผิดพลาดจาก backend ที่หน้านี้ต้องรองรับ */
const ERROR_TEXT: Record<string, string> = {
  FORBIDDEN: 'บัญชีของคุณไม่มีสิทธิ์ทำรายการนี้ ต้องมีบทบาท super_admin_affairs',
  NO_SCOPE_ASSIGNED: 'บัญชีของคุณยังไม่ได้รับมอบหมายหน่วยงาน ติดต่อผู้ดูแลระบบ',
  TARGET_SCOPE_OUT_OF_BOUND: 'มีหน่วยงานที่อยู่นอกขอบเขตที่คุณดูแล',
  INVALID_HOSPCODE: 'มีรหัสหน่วยงานที่ไม่มีอยู่ในระบบ',
  ROLE_NOT_FOUND: 'ไม่พบบทบาท admin_affairs หรือบทบาทถูกปิดใช้งาน',
  USER_NOT_FOUND: 'ไม่พบบัญชีเป้าหมายในระบบ'
};

@Component({
  selector: 'app-finance-user-admin',
  imports: [
    FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatIconModule, MatChipsModule,
    DataTableComponent, HasPermissionDirective
  ],
  templateUrl: './finance-user-admin.component.html',
  styleUrl: './finance-user-admin.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FinanceUserAdminComponent {
  private readonly service = inject(FinanceAdminService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);

  private readonly user = toSignal(this.authService.user$, { initialValue: null });

  readonly rows = signal<AdminRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly searchText = signal('');

  /** null = โหมดแต่งตั้งใหม่, มีค่า = โหมดแก้ไขบัญชีนั้น */
  readonly editing = signal<AdminRow | null>(null);
  readonly formCid = signal('');
  readonly formHospcodes = signal<string[]>([]);

  /**
   * ตัวเลือกหน่วยงานคือ Scope ของผู้ใช้เอง ซึ่งอยู่ใน token อยู่แล้ว
   * backend อนุญาตเฉพาะหน่วยงานในชุดนี้ การให้เลือกแทนพิมพ์จึงทำให้
   * TARGET_SCOPE_OUT_OF_BOUND เกิดจากหน้าเว็บไม่ได้อีก
   *
   * ข้อจำกัด: token มีแต่รหัส ไม่มีชื่อหน่วยงาน จนกว่า backend จะส่งชื่อมาด้วย
   */
  readonly hospcodeOptions = computed(() => this.user()?.hospcodes ?? []);
  readonly isGlobalScope = computed(() => this.user()?.scopeType === 'ALL');

  readonly columns: DataTableColumn<AdminRow>[] = [
    { key: 'name', header: 'ชื่อ', cell: (row) => this.fullName(row) },
    { key: 'cid', header: 'เลขบัตรประชาชน', cell: (row) => this.maskCid(row.cid), cssClass: 'mono' },
    { key: 'roles', header: 'บทบาท', cell: (row) => row.role_codes.join(', ') || '-' },
    { key: 'scope', header: 'หน่วยงาน', cell: (row) => row.hospcodes.join(', ') || '-' }
  ];

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.service.list(this.searchText(), this.page(), this.pageSize()).subscribe({
      next: (res) => {
        this.rows.set(res?.data?.rows ?? []);
        this.total.set(Number(res?.data?.total ?? 0));
        this.loading.set(false);
      },
      error: (error) => {
        this.rows.set([]);
        this.total.set(0);
        this.errorMessage.set(this.toMessage(error, 'โหลดข้อมูลไม่สำเร็จ'));
        this.loading.set(false);
      }
    });
  }

  onSearch(): void {
    this.page.set(1);
    this.load();
  }

  onClearSearch(): void {
    this.searchText.set('');
    this.page.set(1);
    this.load();
  }

  onPageChange(event: { page: number; pageSize: number }): void {
    this.page.set(event.page);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  startEdit(row: AdminRow): void {
    this.editing.set(row);
    this.formCid.set(row.cid);
    this.formHospcodes.set([...row.hospcodes]);
    this.errorMessage.set(null);
  }

  cancelEdit(): void {
    this.editing.set(null);
    this.formCid.set('');
    this.formHospcodes.set([]);
    this.errorMessage.set(null);
  }

  /** ปุ่มบันทึกกดได้เมื่อ CID ครบ 13 หลักและเลือกหน่วยงานอย่างน้อยหนึ่งแห่ง */
  readonly canSubmit = computed(() =>
    /^\d{13}$/.test(this.formCid().trim()) && this.formHospcodes().length > 0
  );

  save(): void {
    if (!this.canSubmit()) return;

    const payload = { cid: this.formCid().trim(), hospcodes: this.formHospcodes() };
    const target = this.editing();
    const request$ = target
      ? this.service.update(target.user_id, payload)
      : this.service.create(payload);

    this.loading.set(true);
    request$.subscribe({
      next: () => {
        this.cancelEdit();
        this.load();
      },
      error: (error) => {
        this.errorMessage.set(this.toMessage(error, target ? 'แก้ไขไม่สำเร็จ' : 'บันทึกไม่สำเร็จ'));
        this.loading.set(false);
      }
    });
  }

  confirmDeactivate(row: AdminRow): void {
    const otherRoles = row.role_codes.filter((code) => code !== FINANCE_ROLE);

    const consequences = [
      `ถอดบทบาท ${FINANCE_ROLE} ออกจากบัญชีนี้`,
      `ล้างหน่วยงานที่รับผิดชอบทั้งหมด ${row.hospcodes.length} แห่ง`
    ];

    if (otherRoles.length) {
      consequences.push(
        `บทบาทที่เหลือ (${otherRoles.join(', ')}) ยังอยู่ แต่จะใช้งานไม่ได้เพราะไม่มีหน่วยงาน`
      );
    }

    const data: ConfirmDialogData = {
      title: 'ยืนยันถอนสิทธิ์ผู้ดูแลการเงิน',
      message: `${this.fullName(row)} (${this.maskCid(row.cid)})`,
      consequences,
      warning: otherRoles.length
        ? 'ขอบเขตหน่วยงานเป็นของบัญชีรวมทุกบทบาท การถอนครั้งนี้จึงกระทบเมนูอื่นที่บัญชีนี้ใช้อยู่ด้วย'
        : undefined,
      confirmLabel: 'ถอนสิทธิ์',
      danger: true
    };

    this.dialog.open(ConfirmDialogComponent, { data, width: '32rem' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) this.deactivate(row);
      });
  }

  private deactivate(row: AdminRow): void {
    this.loading.set(true);
    this.service.deactivate(row.user_id).subscribe({
      next: () => this.load(),
      error: (error) => {
        this.errorMessage.set(this.toMessage(error, 'ถอนสิทธิ์ไม่สำเร็จ'));
        this.loading.set(false);
      }
    });
  }

  /** ใช้เฉพาะกรณี Scope ALL ที่ต้องพิมพ์รหัสหน่วยงานเอง */
  onHospcodesText(value: string): void {
    this.formHospcodes.set(
      value.split(',').map((code) => code.trim()).filter(Boolean)
    );
  }

  fullName(row: AdminRow): string {
    const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();
    return name || '(ยังไม่มีชื่อในระบบ)';
  }

  /** ปิดหลักกลางให้สอดคล้องกับหน้า Attendance และ User MyMOPH */
  maskCid(cid: string): string {
    const value = String(cid ?? '').trim();
    if (value.length !== 13) return value || '-';
    return `${value.slice(0, 4)}xxxxx${value.slice(9)}`;
  }

  private toMessage(error: unknown, fallback: string): string {
    const code = (error as { error?: { error?: string } })?.error?.error;
    if (!code) return fallback;
    return ERROR_TEXT[code] ?? `${fallback} (${code})`;
  }
}
