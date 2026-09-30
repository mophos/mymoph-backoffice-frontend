import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { filter, switchMap } from 'rxjs';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { TableComponent, TableColumn } from '../../shared/ui/table/table.component';
import { AppDialogService } from '../../shared/ui/dialog/dialog.service';
import { MymophUserRow, MymophUsersService } from './mymoph-users.service';
import { DeleteReasonData, DeleteReasonDialogComponent } from './delete-reason-dialog.component';

/** ผลการตรวจฐานบุคลากรของแต่ละแถว เก็บชั่วคราวจนกว่าจะค้นใหม่ */
type HrStatus = 'checking' | 'found' | 'not-found' | 'error';

const ERROR_TEXT: Record<string, string> = {
  GLOBAL_SCOPE_REQUIRED: 'เมนูนี้ต้องมีขอบเขตทุกหน่วยงาน หรือบทบาท user_mymoph',
  INVALID_SEARCH: 'คำค้นต้องมี 3 ถึง 100 ตัวอักษร',
  SEARCH_TOO_SHORT: 'คำค้นต้องมีอย่างน้อย 3 ตัวอักษร',
  INVALID_MONGO_ID: 'รหัสบัญชีไม่ถูกต้อง',
  INVALID_DELETE_REASON: 'เหตุผลต้องมี 5 ถึง 500 ตัวอักษร',
  MYMOPH_USER_NOT_FOUND: 'ไม่พบบัญชีนี้แล้ว อาจถูกลบไปก่อนหน้า',
  MYMOPH_USER_INVALID_CID: 'บัญชีนี้ไม่มีเลขบัตรประชาชน 13 หลัก จึงตรวจฐานบุคลากรไม่ได้',
  MYMOPH_USER_DELETE_CONFLICT: 'มีการแก้ไขบัญชีนี้พร้อมกัน ลองใหม่อีกครั้ง',
  HR_STATUS_SERVICE_UNAVAILABLE: 'ระบบฐานบุคลากรไม่ตอบสนอง ลองใหม่ภายหลัง'
};

@Component({
  selector: 'app-mymoph-users',
  imports: [TableComponent, HasPermissionDirective],
  templateUrl: './mymoph-users.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MymophUsersComponent {
  private readonly service = inject(MymophUsersService);
  private readonly dialogs = inject(AppDialogService);

  readonly rows = signal<MymophUserRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly searchText = signal('');
  /** คำค้นที่ยิงไปแล้วจริง แยกจากสิ่งที่กำลังพิมพ์ */
  readonly appliedSearch = signal('');

  readonly hrStatus = signal<Record<string, HrStatus>>({});

  readonly canSearch = computed(() => this.searchText().trim().length >= 3);

  /** ยังไม่เคยค้น ให้บอกวิธีใช้แทนที่จะโชว์ตารางว่าง */
  readonly hasSearched = computed(() => this.appliedSearch().length > 0);

  readonly columns: TableColumn<MymophUserRow>[] = [
    { key: 'name', header: 'ชื่อ', cell: (row) => this.displayName(row) },
    {
      key: 'cid',
      header: 'เลขบัตรประชาชน',
      cell: (row) => row.cidMasked || '-',
      cellClass: 'font-mono tabular-nums'
    },
    { key: 'email', header: 'อีเมล', cell: (row) => row.email || '-', hideOnMobile: true },
    { key: 'kyc', header: 'ยืนยันตัวตน', cell: (row) => this.kycLabel(row.isKyc) },
    { key: 'hr', header: 'ฐานบุคลากร', cell: (row) => this.hrLabel(row) }
  ];

  onSearchInput(value: string): void {
    this.searchText.set(value);
  }

  onSearch(): void {
    if (!this.canSearch()) {
      this.errorMessage.set('กรุณาระบุเลขบัตรประชาชน ชื่อ หรืออีเมลอย่างน้อย 3 ตัวอักษร');
      return;
    }

    this.clearMessages();
    this.appliedSearch.set(this.searchText().trim());
    this.page.set(1);
    this.hrStatus.set({});
    this.load();
  }

  onClearSearch(): void {
    this.searchText.set('');
    this.appliedSearch.set('');
    this.rows.set([]);
    this.total.set(0);
    this.page.set(1);
    this.hrStatus.set({});
    this.clearMessages();
  }

  onPageChange(event: { page: number; pageSize: number }): void {
    this.page.set(event.page);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  /**
   * ล้างเฉพาะข้อความผิดพลาด ไม่ล้างข้อความสำเร็จ
   * เพราะการลบสำเร็จจะเรียก load() ต่อทันทีเพื่อรีเฟรชตาราง
   * ถ้าล้างทั้งคู่ตรงนี้ ข้อความ "ลบเรียบร้อย" จะหายไปก่อนผู้ใช้ทันเห็น
   */
  private load(): void {
    if (!this.hasSearched()) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    this.service.list({
      search: this.appliedSearch(),
      page: this.page(),
      pageSize: this.pageSize()
    }).subscribe({
      next: (res) => {
        const rows = res?.data?.rows ?? [];
        const total = Number(res?.data?.total ?? 0);

        // ลบแถวสุดท้ายของหน้าท้าย ๆ แล้วหน้านี้จะว่างทั้งที่ยังมีผลการค้นหาอยู่
        // ถอยกลับไปหน้าก่อนหน้าแทนการขึ้นว่า "ไม่พบบัญชี" ซึ่งไม่จริง
        if (!rows.length && total > 0 && this.page() > 1) {
          this.page.update((page) => page - 1);
          this.load();
          return;
        }

        this.rows.set(rows);
        this.total.set(total);
        this.loading.set(false);
      },
      error: (error) => {
        this.rows.set([]);
        this.total.set(0);
        this.errorMessage.set(this.toMessage(error, 'ค้นหาไม่สำเร็จ'));
        this.loading.set(false);
      }
    });
  }

  /**
   * ผลการตรวจผูกกับแถว ไม่ใช่แถบข้อความรวมด้านบน
   * ของเดิมขึ้นว่า "พบข้อมูลในฐานบุคลากร" โดยไม่บอกว่าของใคร
   */
  verifyHr(row: MymophUserRow): void {
    this.clearMessages();
    this.setHrStatus(row.id, 'checking');

    this.service.verifyHr(row.id).subscribe({
      next: (res) => this.setHrStatus(row.id, res?.data?.found ? 'found' : 'not-found'),
      error: (error) => {
        this.setHrStatus(row.id, 'error');
        this.errorMessage.set(this.toMessage(error, 'ตรวจสอบฐานบุคลากรไม่สำเร็จ'));
      }
    });
  }

  confirmDelete(row: MymophUserRow): void {
    const data: DeleteReasonData = {
      displayName: this.displayName(row),
      cidMasked: row.cidMasked,
      email: row.email
    };

    this.dialogs
      .open<DeleteReasonDialogComponent, DeleteReasonData, string>(DeleteReasonDialogComponent, {
        data,
        panelClass: ['w-full', 'max-w-xl', 'px-4']
      })
      .pipe(
        filter((reason): reason is string => !!reason),
        switchMap((reason) => {
          this.loading.set(true);
          this.clearMessages();
          return this.service.archiveDelete(row.id, reason);
        })
      )
      .subscribe({
        next: () => {
          this.successMessage.set(`ลบบัญชี ${this.displayName(row)} และเก็บประวัติเรียบร้อยแล้ว`);
          this.load();
        },
        error: (error) => {
          this.errorMessage.set(this.toMessage(error, 'ลบบัญชีไม่สำเร็จ'));
          this.loading.set(false);
        }
      });
  }

  displayName(row: MymophUserRow): string {
    return `${row.firstName} ${row.lastName}`.trim() || '(ไม่มีชื่อในระบบ)';
  }

  kycLabel(status: MymophUserRow['isKyc']): string {
    if (status === 'Y') return 'ยืนยันแล้ว';
    if (status === 'N') return 'ยังไม่ยืนยัน';
    return 'ไม่ทราบสถานะ';
  }

  hrLabel(row: MymophUserRow): string {
    switch (this.hrStatus()[row.id]) {
      case 'checking': return 'กำลังตรวจ...';
      case 'found': return 'พบในฐานบุคลากร';
      case 'not-found': return 'ไม่พบในฐานบุคลากร';
      case 'error': return 'ตรวจไม่สำเร็จ';
      default: return 'ยังไม่ได้ตรวจ';
    }
  }

  isChecking(row: MymophUserRow): boolean {
    return this.hrStatus()[row.id] === 'checking';
  }

  private setHrStatus(id: string, status: HrStatus): void {
    this.hrStatus.update((map) => ({ ...map, [id]: status }));
  }

  private clearMessages(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  private toMessage(error: unknown, fallback: string): string {
    const code = (error as { error?: { error?: string } })?.error?.error;
    if (!code) return fallback;
    return ERROR_TEXT[code] ?? `${fallback} (${code})`;
  }
}
