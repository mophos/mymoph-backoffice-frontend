import { Component, OnInit } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { AttendanceService } from './attendance.service';

@Component({
  selector: 'app-attendance-dashboard',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule],
  template: `
    <section class="card">
      <header>
        <h2>Attendance Dashboard</h2>
      </header>

      <div class="control-grid">
        <section class="control-card">
          <h3>ค้นหาข้อมูล</h3>
          <div class="filters">
            <label>From <input type="date" [(ngModel)]="from" /></label>
            <label>To <input type="date" [(ngModel)]="to" /></label>
            <button (click)="searchSubmit()">Search</button>
          </div>
        </section>

        <section class="control-card">
          <h3>ออกรายงาน Excel / PDF</h3>
          <div class="export-list">
            <div class="export-item">
              <label>Daily Date <input type="date" [(ngModel)]="dailyDate" /></label>
              <div class="export-actions">
                <button (click)="exportDaily()">Excel Daily</button>
                <button class="ghost" (click)="exportDailyPdf()">PDF Daily</button>
              </div>
            </div>
            <div class="export-item">
              <label>Monthly <input type="month" [(ngModel)]="monthlyMonth" /></label>
              <div class="export-actions">
                <button (click)="exportMonthly()">Excel Monthly</button>
                <button class="ghost" (click)="exportMonthlyPdf()">PDF Monthly</button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div class="summary" *ngIf="dashboard">
        <article>
          <p>Total Records</p>
          <strong>{{ dashboard.summary?.total_records || 0 }}</strong>
        </article>
        <article>
          <p>Checked In</p>
          <strong>{{ dashboard.summary?.checked_in_count || 0 }}</strong>
        </article>
        <article>
          <p>Checked Out</p>
          <strong>{{ dashboard.summary?.checked_out_count || 0 }}</strong>
        </article>
      </div>

      <table *ngIf="rows.length">
        <thead>
          <tr>
            <th>CID</th>
            <th>Name</th>
            <th *ngIf="isSuperAdmin">Hospcode</th>
            <th>Date</th>
            <th>Check-in</th>
            <th>Check-out</th>
          </tr>
        </thead>
        <tbody>
          <tr
            *ngFor="let row of rows; let i = index"
            [class.date-divider]="isFirstRowOfDate(i)"
            [class.date-group-alt]="isAltDateGroup(i)"
          >
            <td>{{ row.cid }}</td>
            <td>{{ row.first_name }} {{ row.last_name }}</td>
            <td *ngIf="isSuperAdmin">{{ row.hospcode }}</td>
            <td>{{ formatAttendanceDate(row.attendance_date) }}</td>
            <td>{{ formatAttendanceTime(row.check_in_at) }}</td>
            <td>{{ formatAttendanceTime(row.check_out_at) }}</td>
          </tr>
        </tbody>
      </table>

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
    h2 { margin: 0 0 12px; }
    h3 { margin: 0 0 10px; font-size: 1rem; color: var(--brand-strong); }
    .control-grid {
      display: grid;
      grid-template-columns: minmax(340px, 1.1fr) minmax(340px, 1fr);
      gap: 12px;
      margin-bottom: 14px;
    }
    .control-card {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px;
      background: var(--surface-2);
    }
    .filters {
      display: grid;
      grid-template-columns: repeat(3, minmax(120px, 1fr));
      gap: 10px;
      align-items: end;
    }
    .filters button { height: 38px; }
    .export-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(180px, 1fr));
      gap: 10px;
    }
    .export-item {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px;
      display: grid;
      gap: 8px;
      background: var(--surface);
    }
    .filters label { display: grid; gap: 5px; font-size: 0.85rem; color: var(--muted); }
    .export-item label { display: grid; gap: 5px; font-size: 0.85rem; color: var(--muted); }
    input { padding: 8px; border: 1px solid var(--line); border-radius: 8px; }
    button { padding: 8px 12px; border: 0; border-radius: 8px; background: var(--brand); color: #fff; cursor: pointer; }
    button.ghost {
      border: 1px solid var(--line);
      background: transparent;
      color: inherit;
    }
    .export-actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(120px, 1fr));
      gap: 8px;
    }
    .summary { display: grid; grid-template-columns: repeat(3, minmax(120px, 1fr)); gap: 10px; margin-bottom: 14px; }
    .summary article { background: var(--surface-2); border-radius: 10px; padding: 10px; }
    .summary p { margin: 0; color: var(--muted); }
    .summary strong { font-size: 1.2rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid var(--line); padding: 10px 8px; text-align: left; font-size: 0.9rem; }
    tbody tr.date-group-alt td { background: #f4faf8; }
    tbody tr.date-divider td { border-top: 2px solid #b8d9d1; }
    .pagination { margin-top: 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .pager-actions { display: flex; align-items: center; gap: 8px; }
    @media (max-width: 980px) {
      .control-grid { grid-template-columns: 1fr; }
      .filters { grid-template-columns: 1fr; }
      .export-list { grid-template-columns: 1fr; }
      .pagination { flex-direction: column; align-items: flex-start; }
    }
    `
  ]
})
export class AttendanceDashboardComponent implements OnInit {
  page = 1;
  pageSize = 20;
  total = 0;

  from = this.getTodayLocalDate();
  to = this.getTodayLocalDate();
  dailyDate = this.getTodayLocalDate();
  monthlyMonth = this.getCurrentLocalMonth();

  dashboard: any;
  rows: any[] = [];
  rowDateGroupIndexes: number[] = [];

  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly authService: AuthService
  ) {}

  get isSuperAdmin(): boolean {
    return this.authService.currentUser?.roles?.includes('super_admin') ?? false;
  }

  ngOnInit(): void {
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

  searchSubmit(): void {
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

  load(): void {
    const from = this.from;
    const to = this.to;

    this.attendanceService
      .getDashboard({ from, to })
      .subscribe((res: any) => {
        this.dashboard = res.data;
      });

    this.attendanceService
      .getRecords({
        from,
        to,
        page: this.page,
        pageSize: this.pageSize
      })
      .subscribe({
        next: (res: any) => {
          const data = res?.data ?? {};
          this.total = Number(data.total || 0);
          this.setRows(Array.isArray(data.rows) ? data.rows : []);
          if (this.page > this.totalPages) {
            this.page = this.totalPages;
            this.load();
          }
        },
        error: () => {
          this.total = 0;
          this.setRows([]);
          alert('ไม่สามารถโหลดรายการลงเวลาได้');
        }
      });
  }

  exportDaily(): void {
    const date = this.dailyDate || this.getTodayLocalDate();
    this.attendanceService
      .exportReport({
        reportType: 'daily',
        from: date,
        to: date
      })
      .subscribe({
        next: (response) => this.downloadResponseFile(response, `attendance_daily_${date}.xlsx`),
        error: () => alert('ไม่สามารถออกรายงานรายวันได้')
      });
  }

  exportMonthly(): void {
    const monthRange = this.buildMonthRange(this.monthlyMonth);
    if (!monthRange) return;

    this.attendanceService
      .exportReport({
        reportType: 'monthly',
        from: monthRange.start,
        to: monthRange.end
      })
      .subscribe({
        next: (response) => this.downloadResponseFile(response, `attendance_monthly_${monthRange.monthValue}.xlsx`),
        error: () => alert('ไม่สามารถออกรายงานรายเดือนได้')
      });
  }

  exportDailyPdf(): void {
    const date = this.dailyDate || this.getTodayLocalDate();
    this.attendanceService
      .exportPdfReport({
        reportType: 'daily',
        from: date,
        to: date
      })
      .subscribe({
        next: (response) => this.downloadResponseFile(response, `attendance_daily_${date}.pdf`),
        error: () => alert('ไม่สามารถออกรายงาน PDF รายวันได้')
      });
  }

  exportMonthlyPdf(): void {
    const monthRange = this.buildMonthRange(this.monthlyMonth);
    if (!monthRange) return;

    this.attendanceService
      .exportPdfReport({
        reportType: 'monthly',
        from: monthRange.start,
        to: monthRange.end
      })
      .subscribe({
        next: (response) => this.downloadResponseFile(response, `attendance_monthly_${monthRange.monthValue}.pdf`),
        error: () => alert('ไม่สามารถออกรายงาน PDF รายเดือนได้')
      });
  }

  private buildMonthRange(monthInput: string): { monthValue: string; start: string; end: string } | null {
    const monthValue = monthInput || this.getCurrentLocalMonth();
    const [yearText, monthText] = monthValue.split('-');
    const year = Number(yearText);
    const month = Number(monthText);

    if (!year || !month) {
      alert('รูปแบบเดือนสำหรับรายงานไม่ถูกต้อง');
      return null;
    }

    const start = `${yearText}-${monthText}-01`;
    const endDate = new Date(year, month, 0);
    const end = `${yearText}-${monthText}-${String(endDate.getDate()).padStart(2, '0')}`;
    return { monthValue, start, end };
  }

  private downloadResponseFile(response: any, fallbackFilename: string): void {
    const blob = response?.body as Blob | null;
    if (!blob) {
      alert('ไม่พบไฟล์รายงาน');
      return;
    }

    const contentDisposition = String(response?.headers?.get('content-disposition') ?? '');
    const filename = this.extractFilename(contentDisposition) || fallbackFilename;

    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  private extractFilename(contentDisposition: string): string | null {
    if (!contentDisposition) return null;

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1]);
    }

    const simpleMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
    return simpleMatch?.[1] ?? null;
  }

  formatAttendanceDate(value: unknown): string {
    const text = String(value ?? '').trim();
    if (!text) return '-';

    const dateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!dateMatch) return '-';

    const [, year, month, day] = dateMatch;
    return `${day}/${month}/${year}`;
  }

  formatAttendanceTime(value: unknown): string {
    const text = String(value ?? '').trim();
    if (!text) return '-';

    const timeMatch = text.match(/(?:T|\s)(\d{2}):(\d{2})(?::\d{2})?/);
    if (timeMatch) {
      return `${timeMatch[1]}:${timeMatch[2]}`;
    }

    if (/^\d{2}:\d{2}(?::\d{2})?$/.test(text)) {
      return text.slice(0, 5);
    }

    return '-';
  }

  isFirstRowOfDate(index: number): boolean {
    if (index <= 0) return false;
    return this.rowDateGroupIndexes[index] !== this.rowDateGroupIndexes[index - 1];
  }

  isAltDateGroup(index: number): boolean {
    const groupIndex = this.rowDateGroupIndexes[index] ?? 0;
    return groupIndex % 2 === 1;
  }

  private setRows(rows: any[]): void {
    const sortedRows = this.sortRowsByDateDesc(rows);
    this.rows = sortedRows;
    this.rowDateGroupIndexes = this.buildDateGroupIndexes(sortedRows);
  }

  private sortRowsByDateDesc(rows: any[]): any[] {
    return [...rows].sort((left: any, right: any) => {
      const leftDate = this.extractAttendanceDateKey(left?.attendance_date);
      const rightDate = this.extractAttendanceDateKey(right?.attendance_date);
      const dateCompare = rightDate.localeCompare(leftDate);
      if (dateCompare !== 0) return dateCompare;

      const leftTime =
        this.extractAttendanceTimeSortKey(left?.check_in_at) || this.extractAttendanceTimeSortKey(left?.check_out_at);
      const rightTime =
        this.extractAttendanceTimeSortKey(right?.check_in_at) || this.extractAttendanceTimeSortKey(right?.check_out_at);
      const timeCompare = rightTime.localeCompare(leftTime);
      if (timeCompare !== 0) return timeCompare;

      const leftCid = String(left?.cid ?? '');
      const rightCid = String(right?.cid ?? '');
      return leftCid.localeCompare(rightCid);
    });
  }

  private buildDateGroupIndexes(rows: any[]): number[] {
    let currentGroup = -1;
    let previousDateKey = '';

    return rows.map((row, index) => {
      const dateKey = this.extractAttendanceDateKey(row?.attendance_date);
      if (index === 0 || dateKey !== previousDateKey) {
        currentGroup += 1;
        previousDateKey = dateKey;
      }

      return currentGroup;
    });
  }

  private extractAttendanceDateKey(value: unknown): string {
    const text = String(value ?? '').trim();
    const dateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!dateMatch) return '';

    const [, year, month, day] = dateMatch;
    return `${year}-${month}-${day}`;
  }

  private extractAttendanceTimeSortKey(value: unknown): string {
    const text = String(value ?? '').trim();
    if (!text) return '';

    const timeMatch = text.match(/(?:T|\s)?(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!timeMatch) return '';

    const hour = timeMatch[1];
    const minute = timeMatch[2];
    const second = timeMatch[3] || '00';
    return `${hour}:${minute}:${second}`;
  }

  private getTodayLocalDate(): string {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getCurrentLocalMonth(): string {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}
