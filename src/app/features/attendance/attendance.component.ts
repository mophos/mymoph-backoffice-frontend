import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { TableComponent, TableColumn } from '../../shared/ui/table/table.component';
import { AttendanceService } from './attendance.service';

interface AttendanceRow {
  cid: string;
  first_name?: string | null;
  last_name?: string | null;
  hospcode?: string | null;
  attendance_date?: string | null;
  check_in_at?: string | null;
  check_out_at?: string | null;
}

interface DashboardSummary {
  total_records?: number;
  checked_in_count?: number;
  checked_out_count?: number;
}

type ReportType = 'daily' | 'monthly';

@Component({
  selector: 'app-attendance',
  imports: [TableComponent, HasPermissionDirective],
  templateUrl: './attendance.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceComponent {
  private readonly service = inject(AttendanceService);
  private readonly authService = inject(AuthService);

  private readonly user = toSignal(this.authService.user$, { initialValue: null });

  readonly from = signal(this.todayLocal());
  readonly to = signal(this.todayLocal());
  readonly searchText = signal('');
  /** คำค้นที่ยิงไปแล้วจริง แยกจากสิ่งที่กำลังพิมพ์ */
  readonly appliedSearch = signal('');

  readonly rows = signal<AttendanceRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly summary = signal<DashboardSummary | null>(null);

  readonly dailyDate = signal(this.todayLocal());
  readonly monthlyMonth = signal(this.currentMonthLocal());
  readonly exporting = signal<string | null>(null);

  /**
   * แสดงคอลัมน์หน่วยงานเมื่อผู้ใช้ดูแลมากกว่าหนึ่งแห่ง
   *
   * ของเดิมผูกกับบทบาท super_admin เท่านั้น ผู้ดูแลที่มีสามหน่วยงานจึงมองไม่ออก
   * ว่าแต่ละแถวเป็นของที่ไหน ทั้งที่ backend ส่ง hospcode มาให้อยู่แล้ว
   */
  readonly showHospcode = computed(() => {
    const u = this.user();
    if (!u) return false;
    return u.scopeType === 'ALL' || u.hospcodes.length > 1;
  });

  readonly rangeInvalid = computed(() => !!this.from() && !!this.to() && this.from() > this.to());

  readonly columns = computed<TableColumn<AttendanceRow>[]>(() => {
    const cols: TableColumn<AttendanceRow>[] = [
      { key: 'date', header: 'วันที่', cell: (row) => this.formatDate(row.attendance_date), cellClass: 'whitespace-nowrap' },
      { key: 'name', header: 'ชื่อ', cell: (row) => this.fullName(row) },
      { key: 'cid', header: 'เลขบัตรประชาชน', cell: (row) => String(row.cid ?? '-'), cellClass: 'font-mono tabular-nums' }
    ];

    if (this.showHospcode()) {
      cols.push({ key: 'hospcode', header: 'หน่วยงาน', cell: (row) => String(row.hospcode ?? '-'), cellClass: 'font-mono' });
    }

    cols.push(
      { key: 'in', header: 'เข้างาน', cell: (row) => this.formatTime(row.check_in_at), cellClass: 'tabular-nums whitespace-nowrap' },
      { key: 'out', header: 'ออกงาน', cell: (row) => this.formatTime(row.check_out_at), cellClass: 'tabular-nums whitespace-nowrap' }
    );

    return cols;
  });

  constructor() {
    this.load();
  }

  load(): void {
    if (this.rangeInvalid()) {
      this.errorMessage.set('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const from = this.from();
    const to = this.to();
    const search = this.appliedSearch() || undefined;

    this.service.getDashboard({ from, to }).subscribe({
      next: (res: { data?: { summary?: DashboardSummary } }) => this.summary.set(res?.data?.summary ?? null),
      error: () => this.summary.set(null)
    });

    this.service.getRecords({ from, to, page: this.page(), pageSize: this.pageSize(), search }).subscribe({
      next: (res: { data?: { total?: number; rows?: AttendanceRow[] } }) => {
        const rows = Array.isArray(res?.data?.rows) ? res.data.rows : [];
        const total = Number(res?.data?.total ?? 0);

        if (!rows.length && total > 0 && this.page() > 1) {
          this.page.update((p) => p - 1);
          this.load();
          return;
        }

        // คงการเรียงของเดิม คือวันที่ใหม่สุดก่อน แล้วเวลาใหม่สุดก่อนในวันเดียวกัน
        this.rows.set(this.sortByDateDesc(rows));
        this.total.set(total);
        this.loading.set(false);
      },
      error: (error: { error?: { error?: string } }) => {
        this.rows.set([]);
        this.total.set(0);
        this.errorMessage.set(this.toMessage(error, 'โหลดรายการลงเวลาไม่สำเร็จ'));
        this.loading.set(false);
      }
    });
  }

  onSearch(): void { this.page.set(1); this.appliedSearch.set(this.searchText().trim()); this.load(); }

  onClearSearch(): void { this.searchText.set(''); this.appliedSearch.set(''); this.page.set(1); this.load(); }

  onRangeChange(): void { this.page.set(1); this.load(); }

  onPageChange(event: { page: number; pageSize: number }): void {
    this.page.set(event.page);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  /** ช่วงวันที่ที่ใช้บ่อย กดครั้งเดียวไม่ต้องเลือกสองช่อง */
  setQuickRange(kind: 'today' | 'week' | 'month'): void {
    const now = new Date();
    if (kind === 'today') {
      const d = this.toLocalDate(now);
      this.from.set(d);
      this.to.set(d);
    } else if (kind === 'week') {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      this.from.set(this.toLocalDate(start));
      this.to.set(this.toLocalDate(now));
    } else {
      this.from.set(this.toLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)));
      this.to.set(this.toLocalDate(now));
    }
    this.onRangeChange();
  }

  exportExcel(type: ReportType): void { this.runExport(type, 'xlsx'); }

  exportPdf(type: ReportType): void { this.runExport(type, 'pdf'); }

  private runExport(type: ReportType, format: 'xlsx' | 'pdf'): void {
    const key = `${type}-${format}`;
    if (this.exporting()) return;

    const range = type === 'daily'
      ? { from: this.dailyDate() || this.todayLocal(), to: this.dailyDate() || this.todayLocal(), label: this.dailyDate() }
      : this.monthRange(this.monthlyMonth());

    if (!range) {
      this.errorMessage.set('รูปแบบเดือนไม่ถูกต้อง');
      return;
    }

    this.exporting.set(key);
    this.errorMessage.set(null);

    const params = { reportType: type, from: range.from, to: range.to, search: this.appliedSearch() || undefined };
    const request$: Observable<HttpResponse<Blob>> = format === 'xlsx'
      ? this.service.exportReport(params)
      : this.service.exportPdfReport(params);

    request$.subscribe({
      next: (response) => {
        this.exporting.set(null);
        this.download(response, `attendance_${type}_${range.label}.${format}`);
      },
      error: (error: { error?: { error?: string } }) => {
        this.exporting.set(null);
        this.errorMessage.set(this.toMessage(error, `ออกรายงาน${type === 'daily' ? 'รายวัน' : 'รายเดือน'}ไม่สำเร็จ`));
      }
    });
  }

  isExporting(type: ReportType, format: 'xlsx' | 'pdf'): boolean {
    return this.exporting() === `${type}-${format}`;
  }

  fullName(row: AttendanceRow): string {
    return `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || '(ไม่มีชื่อในระบบ)';
  }

  formatDate(value: unknown): string {
    const m = String(value ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '-';
  }

  formatTime(value: unknown): string {
    const text = String(value ?? '').trim();
    if (!text) return '-';
    const m = text.match(/(?:T|\s)(\d{2}):(\d{2})/);
    if (m) return `${m[1]}:${m[2]}`;
    if (/^\d{2}:\d{2}/.test(text)) return text.slice(0, 5);
    return '-';
  }

  private sortByDateDesc(rows: AttendanceRow[]): AttendanceRow[] {
    const dateKey = (v: unknown) => String(v ?? '').trim().match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? '';
    const timeKey = (v: unknown) => String(v ?? '').trim().match(/(?:T|\s)?(\d{2}:\d{2}(?::\d{2})?)/)?.[1] ?? '';

    return [...rows].sort((a, b) => {
      const byDate = dateKey(b.attendance_date).localeCompare(dateKey(a.attendance_date));
      if (byDate !== 0) return byDate;
      const at = timeKey(a.check_in_at) || timeKey(a.check_out_at);
      const bt = timeKey(b.check_in_at) || timeKey(b.check_out_at);
      const byTime = bt.localeCompare(at);
      if (byTime !== 0) return byTime;
      return String(a.cid ?? '').localeCompare(String(b.cid ?? ''));
    });
  }

  private monthRange(month: string): { from: string; to: string; label: string } | null {
    const value = month || this.currentMonthLocal();
    const [y, m] = value.split('-');
    const year = Number(y);
    const mon = Number(m);
    if (!year || !mon) return null;

    const last = new Date(year, mon, 0).getDate();
    return { from: `${y}-${m}-01`, to: `${y}-${m}-${String(last).padStart(2, '0')}`, label: value };
  }

  private download(response: HttpResponse<Blob>, fallback: string): void {
    const blob = response.body;
    if (!blob) {
      this.errorMessage.set('ไม่พบไฟล์รายงาน');
      return;
    }

    const name = this.extractFilename(response.headers.get('content-disposition')) ?? fallback;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private extractFilename(contentDisposition: string | null): string | null {
    if (!contentDisposition) return null;
    const utf8 = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8?.[1]) return decodeURIComponent(utf8[1]).replace(/["']/g, '');
    return contentDisposition.match(/filename="?([^"]+)"?/i)?.[1] ?? null;
  }

  /** แปลรหัสจาก backend ให้เป็นภาษาคน */
  private toMessage(error: { error?: { error?: string } }, fallback: string): string {
    const map: Record<string, string> = {
      INVALID_DATE_FROM: 'รูปแบบวันที่เริ่มต้นไม่ถูกต้อง',
      INVALID_DATE_TO: 'รูปแบบวันที่สิ้นสุดไม่ถูกต้อง',
      DATE_RANGE_INVERTED: 'วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด',
      FORBIDDEN: 'บัญชีของคุณไม่มีสิทธิ์ทำรายการนี้',
      NO_SCOPE_ASSIGNED: 'บัญชีของคุณยังไม่ได้รับมอบหมายหน่วยงาน ติดต่อผู้ดูแลระบบ'
    };
    const code = error?.error?.error;
    if (!code) return fallback;
    return map[code] ?? `${fallback} (${code})`;
  }

  private toLocalDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private todayLocal(): string { return this.toLocalDate(new Date()); }

  private currentMonthLocal(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}
