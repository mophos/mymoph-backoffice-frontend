import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { TableComponent, TableColumn } from '../../shared/ui/table/table.component';
import { AppDialogService } from '../../shared/ui/dialog/dialog.service';
import { PersonnelRow, PersonnelService } from './personnel.service';
import {
  PersonnelFormData,
  PersonnelFormDialogComponent,
  PersonnelFormResult
} from './personnel-form-dialog.component';

interface UploadResult {
  processedCount: number;
  insertedCount: number;
  updatedCount: number;
  errorCount: number;
  errors: Array<{ rowNumber: number; error: string }>;
}

const ERROR_TEXT: Record<string, string> = {
  PERSONNEL_NOT_FOUND: 'ไม่พบข้อมูลบุคลากรนี้ อาจถูกลบไปก่อนหน้า',
  PERSONNEL_ALREADY_EXISTS: 'มีข้อมูลบุคลากรที่ใช้เลขบัตรนี้ในหน่วยงานเดียวกันอยู่แล้ว',
  INVALID_CID: 'เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก',
  INVALID_NAME: 'ต้องระบุทั้งชื่อและนามสกุล',
  INVALID_HOSPCODE: 'ต้องระบุหน่วยงาน',
  HOSPCODE_NOT_FOUND: 'ไม่พบรหัสหน่วยงานนี้ในทะเบียนกลาง',
  OFFICE_WITHOUT_CODE5: 'หน่วยงานนี้ยังไม่มีรหัส 5 หลัก จึงยังบันทึกข้อมูลบุคลากรไม่ได้',
  MISSING_HOSPCODE: 'ไฟล์ Excel ต้องระบุหน่วยงาน',
  MISSING_NAME: 'ต้องระบุทั้งชื่อและนามสกุล',
  SCOPE_FORBIDDEN: 'หน่วยงานนี้อยู่นอกขอบเขตที่คุณดูแล',
  NO_SCOPE_ASSIGNED: 'บัญชีของคุณยังไม่ได้รับมอบหมายหน่วยงาน ติดต่อผู้ดูแลระบบ',
  INVALID_TEMPLATE_HEADER: 'หัวตารางในไฟล์ Excel ไม่ตรงกับแบบฟอร์ม กรุณาดาวน์โหลดแบบฟอร์มใหม่',
  NO_DATA_IN_EXCEL: 'ไม่พบข้อมูลในไฟล์ Excel',
  EMPTY_EXCEL_FILE: 'ไฟล์ Excel ว่างเปล่า',
  FILE_REQUIRED: 'กรุณาเลือกไฟล์ Excel'
};

@Component({
  selector: 'app-personnel',
  imports: [TableComponent, HasPermissionDirective],
  templateUrl: './personnel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PersonnelComponent {
  private readonly service = inject(PersonnelService);
  private readonly authService = inject(AuthService);
  private readonly dialogs = inject(AppDialogService);

  private readonly user = toSignal(this.authService.user$, { initialValue: null });

  readonly rows = signal<PersonnelRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly searchText = signal('');

  readonly selectedFile = signal<File | null>(null);
  readonly uploading = signal(false);
  readonly uploadResult = signal<UploadResult | null>(null);

  /**
   * ผู้ที่ดูแลหน่วยงานเดียวไม่ต้องเลือกหน่วยงานเอง และไม่ต้องเห็นคอลัมน์นั้น
   * เพราะทุกแถวเป็นหน่วยงานเดียวกันหมด
   */
  readonly lockedHospcode = computed(() => {
    const u = this.user();
    return u?.scopeType === 'LIST' && u.hospcodes.length === 1 ? u.hospcodes[0] : null;
  });

  readonly columns = computed<TableColumn<PersonnelRow>[]>(() => {
    const base: TableColumn<PersonnelRow>[] = [
      { key: 'name', header: 'ชื่อ', cell: (row) => this.fullName(row) },
      {
        key: 'cid',
        header: 'เลขบัตรประชาชน',
        cell: (row) => this.maskCid(row.cid),
        cellClass: 'font-mono tabular-nums'
      }
    ];

    if (!this.lockedHospcode()) {
      base.push({ key: 'hospcode', header: 'หน่วยงาน', cell: (row) => row.hospcode || '-', cellClass: 'font-mono' });
    }

    base.push({
      key: 'updated',
      header: 'อัปเดตล่าสุด',
      cell: (row) => this.formatDateTime(row.updated_at),
      hideOnMobile: true
    });

    return base;
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.service.list({
      search: this.searchText().trim() || undefined,
      page: this.page(),
      pageSize: this.pageSize()
    }).subscribe({
      next: (res) => {
        const rows = res?.data?.rows ?? [];
        const total = Number(res?.data?.total ?? 0);

        // ลบแถวสุดท้ายของหน้าท้าย ๆ แล้วหน้านี้จะว่างทั้งที่ยังมีข้อมูลอยู่
        if (!rows.length && total > 0 && this.page() > 1) {
          this.page.update((p) => p - 1);
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
        this.errorMessage.set(this.toMessage(error, 'โหลดข้อมูลไม่สำเร็จ'));
        this.loading.set(false);
      }
    });
  }

  onSearchInput(value: string): void { this.searchText.set(value); }

  onSearch(): void { this.clearMessages(); this.page.set(1); this.load(); }

  onClearSearch(): void { this.searchText.set(''); this.clearMessages(); this.page.set(1); this.load(); }

  onPageChange(event: { page: number; pageSize: number }): void {
    this.page.set(event.page);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  openCreate(): void { this.openForm(null); }

  openEdit(row: PersonnelRow): void { this.openForm(row); }

  private openForm(row: PersonnelRow | null): void {
    const data: PersonnelFormData = {
      editing: row
        ? {
            id: row.id,
            cid: row.cid,
            firstName: row.first_name,
            lastName: row.last_name,
            hospcode: row.hospcode
          }
        : null,
      lockedHospcode: this.lockedHospcode()
    };

    this.dialogs
      .open<PersonnelFormDialogComponent, PersonnelFormData, PersonnelFormResult>(
        PersonnelFormDialogComponent,
        { data, panelClass: ['w-full', 'max-w-3xl', 'px-4'] }
      )
      .pipe(filter((result): result is PersonnelFormResult => !!result))
      .subscribe((result) => this.submit(row, result));
  }

  private submit(row: PersonnelRow | null, result: PersonnelFormResult): void {
    this.loading.set(true);
    this.clearMessages();

    const request$ = row
      ? this.service.update(row.id, result)
      : this.service.create(result);

    request$.subscribe({
      next: () => {
        this.successMessage.set(row ? 'แก้ไขข้อมูลเรียบร้อยแล้ว' : 'เพิ่มข้อมูลบุคลากรเรียบร้อยแล้ว');
        if (!row) this.page.set(1);
        this.load();
      },
      error: (error) => {
        this.errorMessage.set(this.toMessage(error, row ? 'แก้ไขไม่สำเร็จ' : 'เพิ่มข้อมูลไม่สำเร็จ'));
        this.loading.set(false);
      }
    });
  }

  confirmDelete(row: PersonnelRow): void {
    this.dialogs
      .confirm({
        title: 'ยืนยันลบข้อมูลบุคลากร',
        message: `${this.fullName(row)} (${this.maskCid(row.cid)})`,
        consequences: [
          'ข้อมูลจะถูกปิดการใช้งาน ไม่แสดงในรายการอีก',
          'ประวัติการลงเวลาที่บันทึกไว้แล้วยังอยู่ ไม่ถูกลบ'
        ],
        confirmLabel: 'ลบข้อมูล',
        danger: true
      })
      .pipe(
        filter(Boolean),
        switchMap(() => {
          this.loading.set(true);
          this.clearMessages();
          return this.service.remove(row.id);
        })
      )
      .subscribe({
        next: () => {
          this.successMessage.set(`ลบข้อมูลของ ${this.fullName(row)} เรียบร้อยแล้ว`);
          this.load();
        },
        error: (error) => {
          this.errorMessage.set(this.toMessage(error, 'ลบข้อมูลไม่สำเร็จ'));
          this.loading.set(false);
        }
      });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] ?? null);
    this.uploadResult.set(null);
    this.clearMessages();
  }

  downloadTemplate(): void {
    this.clearMessages();
    this.service.downloadTemplate().subscribe({
      next: (response) => {
        const blob = response.body;
        if (!blob) {
          this.errorMessage.set('ไม่พบไฟล์แบบฟอร์ม');
          return;
        }

        const name = this.extractFilename(response.headers.get('content-disposition'))
          ?? 'personnel-template.xlsx';
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = name;
        anchor.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.errorMessage.set('ดาวน์โหลดแบบฟอร์มไม่สำเร็จ')
    });
  }

  uploadExcel(): void {
    const file = this.selectedFile();
    if (!file || this.uploading()) return;

    this.uploading.set(true);
    this.uploadResult.set(null);
    this.clearMessages();

    this.service.uploadExcel(file).subscribe({
      next: (res) => {
        this.uploadResult.set(res?.data ?? null);
        this.selectedFile.set(null);
        this.uploading.set(false);
        this.page.set(1);
        this.load();
      },
      error: (error) => {
        this.uploading.set(false);
        this.errorMessage.set(this.toMessage(error, 'อัปโหลดไม่สำเร็จ'));
      }
    });
  }

  clearUploadResult(): void { this.uploadResult.set(null); }

  /** แปลรหัสข้อผิดพลาดของแต่ละแถวในไฟล์ให้เป็นภาษาคน */
  rowErrorText(code: string): string {
    return ERROR_TEXT[code] ?? code;
  }

  fullName(row: PersonnelRow): string {
    return `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || '(ไม่มีชื่อในระบบ)';
  }

  /** ปิดหลักกลางให้ตรงกับหน้าอื่นในระบบ */
  maskCid(cid: string): string {
    const value = String(cid ?? '').trim();
    if (value.length !== 13) return value || '-';
    return `${value.slice(0, 4)}xxxxx${value.slice(9)}`;
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('th-TH', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok'
    }).format(date);
  }

  private clearMessages(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  private extractFilename(contentDisposition: string | null): string | null {
    if (!contentDisposition) return null;
    const utf8 = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8?.[1]) return decodeURIComponent(utf8[1]).replace(/["']/g, '');
    return contentDisposition.match(/filename="?([^"]+)"?/i)?.[1] ?? null;
  }

  private toMessage(error: unknown, fallback: string): string {
    const code = (error as { error?: { error?: string } })?.error?.error;
    if (!code) return fallback;
    return ERROR_TEXT[code] ?? `${fallback} (${code})`;
  }
}
