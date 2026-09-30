import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { filter, switchMap } from 'rxjs';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { TableComponent, TableColumn } from '../../shared/ui/table/table.component';
import { AppDialogService } from '../../shared/ui/dialog/dialog.service';
import { FinanceAdminRow, FinanceAdminService } from './finance-admin.service';
import {
  FinanceFormData,
  FinanceFormDialogComponent,
  FinanceFormResult
} from './finance-form-dialog.component';

const FINANCE_ROLE = 'admin_affairs';

/** ข้อความผิดพลาดจาก backend ที่หน้านี้ต้องรองรับ */
const ERROR_TEXT: Record<string, string> = {
  FORBIDDEN: 'บัญชีของคุณไม่มีสิทธิ์ทำรายการนี้ ต้องมีบทบาท super_admin_affairs',
  NO_SCOPE_ASSIGNED: 'บัญชีของคุณยังไม่ได้รับมอบหมายหน่วยงาน ติดต่อผู้ดูแลระบบ',
  TARGET_SCOPE_OUT_OF_BOUND: 'มีหน่วยงานที่อยู่นอกขอบเขตที่คุณดูแล',
  TARGET_OUT_OF_SCOPE: 'บัญชีเป้าหมายดูแลหน่วยงานที่อยู่นอกขอบเขตของคุณ',
  HOSPCODES_REQUIRED: 'ต้องระบุหน่วยงานอย่างน้อยหนึ่งแห่ง',
  INVALID_HOSPCODE: 'มีรหัสหน่วยงานที่ไม่มีอยู่ในระบบ',
  OFFICE_WITHOUT_CODE5: 'หน่วยงานนี้ยังไม่มีรหัส 5 หลัก จึงยังมอบหมายผู้ดูแลไม่ได้',
  CID_MISMATCH: 'เลขบัตรประชาชนไม่ตรงกับบัญชีเป้าหมาย ต้องถอนสิทธิ์เดิมแล้วแต่งตั้งใหม่',
  ROLE_NOT_FOUND: 'ไม่พบบทบาท admin_affairs หรือบทบาทถูกปิดใช้งาน',
  USER_NOT_FOUND: 'ไม่พบบัญชีเป้าหมายในระบบ'
};

@Component({
  selector: 'app-finance-user-admin',
  imports: [TableComponent, HasPermissionDirective],
  templateUrl: './finance-user-admin.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FinanceUserAdminComponent {
  private readonly service = inject(FinanceAdminService);
  private readonly dialogs = inject(AppDialogService);

  readonly rows = signal<FinanceAdminRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly searchText = signal('');

  readonly columns: TableColumn<FinanceAdminRow>[] = [
    { key: 'name', header: 'ชื่อ', cell: (row) => this.fullName(row) },
    {
      key: 'cid',
      header: 'เลขบัตรประชาชน',
      cell: (row) => this.maskCid(row.cid),
      cellClass: 'font-mono tabular-nums'
    },
    { key: 'scope', header: 'หน่วยงานที่รับผิดชอบ', cell: (row) => this.officeLabel(row) },
    {
      key: 'count',
      header: 'จำนวน',
      cell: (row) => `${row.hospcodes.length} แห่ง`,
      cellClass: 'tabular-nums text-end whitespace-nowrap',
      hideOnMobile: true
    }
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

  openCreate(): void { this.openForm(null); }

  openEdit(row: FinanceAdminRow): void { this.openForm(row); }

  private openForm(row: FinanceAdminRow | null): void {
    const data: FinanceFormData = {
      editing: row
        ? {
            user_id: row.user_id,
            cid: row.cid,
            displayName: `${this.fullName(row)} (${this.maskCid(row.cid)})`,
            hospcodes: row.hospcodes
          }
        : null
    };

    this.dialogs
      .open<FinanceFormDialogComponent, FinanceFormData, FinanceFormResult>(
        FinanceFormDialogComponent,
        { data, panelClass: ['w-full', 'max-w-3xl', 'px-4'] }
      )
      .pipe(filter((result): result is FinanceFormResult => !!result))
      .subscribe((result) => this.afterForm(row, result));
  }

  /**
   * การบันทึกแทนที่ขอบเขตทั้งชุด ไม่ใช่การเพิ่มเข้าไป
   * ถ้ามีหน่วยงานหายไปจึงต้องให้ยืนยันก่อน
   */
  private afterForm(row: FinanceAdminRow | null, result: FinanceFormResult): void {
    if (!result.removedHospcodes.length) {
      this.submit(row, result);
      return;
    }

    this.dialogs
      .confirm({
        title: 'ยืนยันการเปลี่ยนหน่วยงาน',
        message: row ? `${this.fullName(row)} (${this.maskCid(row.cid)})` : '',
        consequences: [
          `หน่วยงานที่จะถูกถอดออก ${result.removedHospcodes.length} แห่ง`,
          `หน่วยงานหลังบันทึก ${result.hospcodes.length} แห่ง`
        ],
        warning: 'ขอบเขตหน่วยงานเป็นของบัญชีรวมทุกบทบาท การถอดจึงกระทบเมนูอื่นที่บัญชีนี้ใช้อยู่ด้วย',
        confirmLabel: 'บันทึก',
        danger: true
      })
      .pipe(filter(Boolean))
      .subscribe(() => this.submit(row, result));
  }

  private submit(row: FinanceAdminRow | null, result: FinanceFormResult): void {
    const payload = { cid: result.cid, hospcodes: result.hospcodes };
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

  confirmDeactivate(row: FinanceAdminRow): void {
    const otherRoles = row.role_codes.filter((code) => code !== FINANCE_ROLE);

    const consequences = [
      'ถอดบทบาทผู้ดูแลการเงินหน่วยงาน (admin_affairs) ออกจากบัญชีนี้'
    ];

    // ADMIN-02: ขอบเขตจะถูกล้างเฉพาะเมื่อไม่เหลือบทบาทอื่นแล้ว
    if (otherRoles.length) {
      consequences.push(
        `บทบาทที่เหลือ (${otherRoles.join(', ')}) และหน่วยงานที่รับผิดชอบยังอยู่ครบ`
      );
    } else {
      consequences.push(`ล้างหน่วยงานที่รับผิดชอบทั้งหมด ${row.hospcodes.length} แห่ง`);
    }

    this.dialogs
      .confirm({
        title: 'ยืนยันถอนสิทธิ์ผู้ดูแลการเงิน',
        message: `${this.fullName(row)} (${this.maskCid(row.cid)})`,
        consequences,
        warning: 'token ที่บัญชีนี้ถืออยู่จะยังใช้สิทธิ์เดิมได้จนกว่าจะหมดอายุ',
        confirmLabel: 'ถอนสิทธิ์',
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
          this.errorMessage.set(this.toMessage(error, 'ถอนสิทธิ์ไม่สำเร็จ'));
          this.loading.set(false);
        }
      });
  }

  /**
   * แสดงชื่อหน่วยงานพร้อม hcode9 ตามมาตรฐานใหม่
   * ถ้าทะเบียนกลางไม่มีรหัสนั้น จะเหลือแค่รหัสเดิมที่บันทึกไว้
   */
  officeLabel(row: FinanceAdminRow): string {
    const offices = row.offices ?? [];
    if (!offices.length) {
      return row.hospcodes.length ? row.hospcodes.join(', ') : 'ไม่มี';
    }

    return offices
      .map((office) => (office.name ? `${office.name} (${office.hcode9})` : office.code5))
      .join(', ');
  }

  fullName(row: FinanceAdminRow): string {
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
