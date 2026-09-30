import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, filter } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { TableComponent, TableColumn } from '../../shared/ui/table/table.component';
import { AppDialogService } from '../../shared/ui/dialog/dialog.service';
import { HrAdminService } from '../hr-admin/hr-admin.service';
import { UserFormDialogComponent, UserFormData, UserFormResult } from './user-form-dialog.component';
import { roleLabels } from './role-options';

/** ข้อมูลหน่วยงานจากทะเบียนกลาง backend ส่งมาคู่กับ hospcodes เดิม */
interface OfficeRef {
  code5: string;
  hcode9: string;
  name: string;
}

interface AdminRow {
  user_id: string;
  cid: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  role_codes: string[];
  hospcodes: string[];
  offices?: OfficeRef[];
}

const ERROR_TEXT: Record<string, string> = {
  FORBIDDEN: 'บัญชีของคุณไม่มีสิทธิ์ทำรายการนี้',
  NO_SCOPE_ASSIGNED: 'บัญชีของคุณยังไม่ได้รับมอบหมายหน่วยงาน ติดต่อผู้ดูแลระบบ',
  TARGET_SCOPE_OUT_OF_BOUND: 'มีหน่วยงานที่อยู่นอกขอบเขตที่คุณดูแล',
  INVALID_HOSPCODE: 'มีรหัสหน่วยงานที่ไม่มีอยู่ในระบบ',
  OFFICE_WITHOUT_CODE5: 'หน่วยงานนี้ยังไม่มีรหัส 5 หลัก จึงยังมอบหมายผู้ดูแลไม่ได้',
  ROLE_NOT_FOUND: 'มีบทบาทที่ไม่มีอยู่ในระบบหรือถูกปิดใช้งาน',
  ONLY_ROLE_ADMIN_CAN_ASSIGN_SUPER_ADMIN: 'การมอบบทบาทผู้ดูแลระบบต้องมีสิทธิ์ role_admin.manage',
  USER_NOT_FOUND: 'ไม่พบบัญชีเป้าหมายในระบบ'
};

@Component({
  selector: 'app-user-admin',
  imports: [TableComponent, HasPermissionDirective],
  templateUrl: './user-admin.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserAdminComponent {
  private readonly service = inject(HrAdminService);
  private readonly authService = inject(AuthService);
  private readonly dialogs = inject(AppDialogService);

  private readonly user = toSignal(this.authService.user$, { initialValue: null });

  readonly rows = signal<AdminRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly searchText = signal('');

  readonly canAssignSuperAdmin = computed(() =>
    (this.user()?.permissions ?? []).includes('role_admin.manage')
  );

  /** ปิดการใช้งานต้องมี Scope ALL หรือ role_admin.manage ตามที่ service ตรวจ */
  readonly canDeactivate = computed(() =>
    this.user()?.scopeType === 'ALL' || this.canAssignSuperAdmin()
  );

  readonly columns: TableColumn<AdminRow>[] = [
    { key: 'name', header: 'ชื่อ', cell: (row) => this.fullName(row) },
    { key: 'cid', header: 'เลขบัตรประชาชน', cell: (row) => this.maskCid(row.cid), cellClass: 'font-mono tabular-nums' },
    { key: 'roles', header: 'บทบาท', cell: (row) => roleLabels(row.role_codes) },
    { key: 'scope', header: 'หน่วยงาน', cell: (row) => this.officeLabel(row), hideOnMobile: true }
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

  onSearchInput(value: string): void {
    this.searchText.set(value);
  }

  onSearch(): void { this.page.set(1); this.load(); }

  onClearSearch(): void { this.searchText.set(''); this.page.set(1); this.load(); }

  onPageChange(event: { page: number; pageSize: number }): void {
    this.page.set(event.page);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  openCreate(): void {
    this.openForm(null);
  }

  openEdit(row: AdminRow): void {
    this.openForm(row);
  }

  private openForm(row: AdminRow | null): void {
    const data: UserFormData = {
      editing: row
        ? {
            user_id: row.user_id,
            cid: row.cid,
            displayName: `${this.fullName(row)} (${this.maskCid(row.cid)})`,
            role_codes: row.role_codes,
            hospcodes: row.hospcodes
          }
        : null,
      canAssignSuperAdmin: this.canAssignSuperAdmin()
    };

    this.dialogs
      .open<UserFormDialogComponent, UserFormData, UserFormResult>(UserFormDialogComponent, {
        data,
        panelClass: ['w-full', 'max-w-3xl', 'px-4']
      })
      .pipe(filter((result): result is UserFormResult => !!result))
      .subscribe((result) => this.afterForm(row, result));
  }

  /** ถ้าการบันทึกจะถอดบทบาทออก ต้องให้ยืนยันก่อน เพราะ Save แทนที่ทั้งชุด */
  private afterForm(row: AdminRow | null, result: UserFormResult): void {
    if (!result.removedRoles.length) {
      this.submit(row, result);
      return;
    }

    this.dialogs
      .confirm({
        title: 'ยืนยันการเปลี่ยนบทบาท',
        message: row ? `${this.fullName(row)} (${this.maskCid(row.cid)})` : '',
        consequences: [
          `บทบาทที่จะถูกถอดออก: ${roleLabels(result.removedRoles)}`,
          `บทบาทหลังบันทึก: ${roleLabels(result.roleCodes)}`
        ],
        warning: 'การบันทึกจะแทนที่ชุดบทบาททั้งหมด ไม่ใช่การเพิ่มเข้าไป',
        confirmLabel: 'บันทึก',
        danger: true
      })
      .pipe(filter(Boolean))
      .subscribe(() => this.submit(row, result));
  }

  private submit(row: AdminRow | null, result: UserFormResult): void {
    const payload = { cid: result.cid, roleCodes: result.roleCodes, hospcodes: result.hospcodes };
    this.loading.set(true);

    const request$ = row
      ? this.service.update(row.user_id, payload)
      : this.service.create(payload);

    request$.subscribe({
      next: () => this.load(),
      error: (error) => {
        this.errorMessage.set(this.toMessage(error, row ? 'แก้ไขไม่สำเร็จ' : 'บันทึกไม่สำเร็จ'));
        this.loading.set(false);
      }
    });
  }

  confirmDeactivate(row: AdminRow): void {
    this.dialogs
      .confirm({
        title: 'ยืนยันปิดการใช้งานบัญชี',
        message: `${this.fullName(row)} (${this.maskCid(row.cid)})`,
        consequences: [
          `ถอดบทบาททั้งหมด: ${roleLabels(row.role_codes)}`,
          `ล้างหน่วยงานที่รับผิดชอบทั้งหมด ${row.hospcodes.length} แห่ง`,
          'บัญชียังอยู่ในระบบและเข้าสู่ระบบได้ แต่จะไม่เห็นเมนูใดเลย'
        ],
        warning: 'token ที่บัญชีนี้ถืออยู่จะยังใช้สิทธิ์เดิมได้จนกว่าจะหมดอายุ',
        confirmLabel: 'ปิดการใช้งาน',
        danger: true
      })
      .pipe(
        filter(Boolean),
        switchMap(() => {
          this.loading.set(true);
          return this.service.deactivate(row.user_id);
        })
      )
      .subscribe({
        next: () => this.load(),
        error: (error) => {
          this.errorMessage.set(this.toMessage(error, 'ปิดการใช้งานไม่สำเร็จ'));
          this.loading.set(false);
        }
      });
  }

  /**
   * แสดงชื่อหน่วยงานพร้อมรหัสตามมาตรฐานใหม่
   * ถ้าทะเบียนกลางไม่มีรหัสนั้น จะเหลือแค่รหัสเดิมที่บันทึกไว้
   */
  officeLabel(row: AdminRow): string {
    const offices = row.offices ?? [];
    if (!offices.length) {
      return row.hospcodes.length ? row.hospcodes.join(', ') : 'ไม่มี';
    }

    return offices
      .map((office) => (office.name ? `${office.name} (${office.hcode9})` : office.code5))
      .join(', ');
  }

  fullName(row: AdminRow): string {
    const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();
    return name || '(ยังไม่มีชื่อในระบบ)';
  }

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
