import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { TableComponent, TableColumn } from '../../shared/ui/table/table.component';
import { AppDialogService } from '../../shared/ui/dialog/dialog.service';
import { OfficeRow, OfficeService } from './office.service';

const ERROR_TEXT: Record<string, string> = {
  SCOPE_FORBIDDEN: 'หน่วยงานนี้อยู่นอกขอบเขตที่คุณดูแล',
  NO_SCOPE_ASSIGNED: 'บัญชีของคุณยังไม่ได้รับมอบหมายหน่วยงาน ติดต่อผู้ดูแลระบบ',
  HOSPCODE_NOT_FOUND: 'ไม่พบหน่วยงานนี้ในทะเบียน',
  CHECKIN_OFFICE_TABLE_NOT_FOUND: 'ไม่พบตารางลงทะเบียนในฐาน MyMOPH ติดต่อผู้ดูแลระบบ',
  CHECKIN_OFFICE_TABLE_INVALID: 'โครงสร้างตารางลงทะเบียนในฐาน MyMOPH ไม่ถูกต้อง'
};

@Component({
  selector: 'app-office-settings-v2',
  imports: [TableComponent, HasPermissionDirective],
  templateUrl: './office-settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OfficeSettingsV2Component {
  private readonly service = inject(OfficeService);
  private readonly authService = inject(AuthService);
  private readonly dialogs = inject(AppDialogService);

  private readonly user = toSignal(this.authService.user$, { initialValue: null });

  readonly rows = signal<OfficeRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly searchText = signal('');
  readonly statusFilter = signal<'' | 'Y' | 'N'>('');

  readonly isGlobalScope = computed(() => this.user()?.scopeType === 'ALL');

  readonly columns: TableColumn<OfficeRow>[] = [
    { key: 'name', header: 'หน่วยงาน', cell: (row) => row.name || '(ไม่มีชื่อ)' },
    { key: 'hcode9', header: 'รหัส', cell: (row) => row.hcode9, cellClass: 'font-mono' },
    { key: 'type', header: 'ประเภท', cell: (row) => row.officeType ?? '-', hideOnMobile: true },
    { key: 'area', header: 'พื้นที่', cell: (row) => this.areaLabel(row), hideOnMobile: true },
    { key: 'checkin', header: 'ลงเวลา', cell: (row) => this.checkinLabel(row) }
  ];

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.service.list({
      search: this.searchText(),
      checkinStatus: this.statusFilter(),
      page: this.page(),
      pageSize: this.pageSize()
    }).subscribe({
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

  onSearch(): void { this.page.set(1); this.load(); }

  onClearSearch(): void { this.searchText.set(''); this.page.set(1); this.load(); }

  onStatusFilter(value: string): void {
    this.statusFilter.set(value === 'Y' || value === 'N' ? value : '');
    this.page.set(1);
    this.load();
  }

  onPageChange(event: { page: number; pageSize: number }): void {
    this.page.set(event.page);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  confirmToggle(row: OfficeRow): void {
    const enable = row.checkinStatus !== 'Y';

    const consequences = enable
      ? row.requiresAppSupport
        ? [
            `บันทึกรหัส ${row.hcode9} ลงตารางลงทะเบียนของฐาน MyMOPH`,
            'หน่วยงานนี้ยังไม่มีรหัส 5 หลัก จึงบันทึกด้วยรหัสใหม่อย่างเดียว'
          ]
        : [
            'พนักงานของหน่วยงานนี้จะลงเวลาผ่านแอป MyMOPH ได้',
            `บันทึกรหัส ${row.code5} และ ${row.hcode9} ลงตารางลงทะเบียนของฐาน MyMOPH`
          ]
      : [
          'พนักงานของหน่วยงานนี้จะลงเวลาผ่านแอป MyMOPH ไม่ได้',
          'ข้อมูลการลงเวลาที่บันทึกไว้แล้วยังอยู่ ไม่ถูกลบ'
        ];

    this.dialogs
      .confirm({
        title: enable ? 'ยืนยันเปิดใช้การลงเวลา' : 'ยืนยันปิดการลงเวลา',
        message: `${row.name} (${row.hcode9})`,
        consequences,
        warning: enable
          ? (row.requiresAppSupport
              ? 'แอป MyMOPH ยังอ่านรหัส 5 หลักอยู่ พนักงานจึงยังลงเวลาไม่ได้จนกว่าแอปจะเปลี่ยนไปอ่านรหัสใหม่'
              : undefined)
          : 'แอป MyMOPH อ่านสถานะนี้ไปใช้ การปิดจะมีผลกับผู้ใช้จริงทันที',
        confirmLabel: enable ? 'เปิดใช้' : 'ปิด',
        danger: !enable
      })
      .pipe(
        filter(Boolean),
        switchMap(() => {
          this.loading.set(true);
          return this.service.setCheckin(row.hcode9, enable);
        })
      )
      .subscribe({
        next: () => this.load(),
        error: (error) => {
          this.errorMessage.set(this.toMessage(error, 'เปลี่ยนสถานะไม่สำเร็จ'));
          this.loading.set(false);
        }
      });
  }

  areaLabel(row: OfficeRow): string {
    return [row.district, row.province].filter(Boolean).join(' · ') || '-';
  }

  /**
   * หน่วยงานที่ไม่มีรหัส 5 หลักเปิดใช้ได้ แต่แอป MyMOPH ยังอ่านรหัสเดิมอยู่
   * จึงต้องบอกไว้ในตารางทั้งตอนที่ยังไม่เปิดและตอนที่เปิดแล้ว
   */
  checkinLabel(row: OfficeRow): string {
    if (row.checkinStatus !== 'Y') {
      return row.requiresAppSupport ? 'ยังไม่เปิด · ไม่มีรหัส 5 หลัก' : 'ยังไม่เปิด';
    }
    return row.requiresAppSupport ? 'เปิดแล้ว · รอแอปรองรับ' : 'เปิดใช้แล้ว';
  }

  private toMessage(error: unknown, fallback: string): string {
    const code = (error as { error?: { error?: string } })?.error?.error;
    if (!code) return fallback;
    return ERROR_TEXT[code] ?? `${fallback} (${code})`;
  }
}
