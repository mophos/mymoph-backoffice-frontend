import { Component, OnInit } from '@angular/core';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceService } from './attendance.service';

@Component({
  selector: 'app-attendance-dashboard',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, DatePipe],
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
            <button (click)="load()">Search</button>
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
            <th>Hospcode</th>
            <th>Date</th>
            <th>Check-in</th>
            <th>Check-out</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let row of rows">
            <td>{{ row.cid }}</td>
            <td>{{ row.first_name }} {{ row.last_name }}</td>
            <td>{{ row.hospcode }}</td>
            <td>{{ row.attendance_date | date:'dd MMMM yyyy':'Asia/Bangkok':'th-TH' }}</td>
            <td>{{ row.check_in_at | date:'short':'Asia/Bangkok' }}</td>
            <td>{{ row.check_out_at | date:'short':'Asia/Bangkok' }}</td>
          </tr>
        </tbody>
      </table>
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
    @media (max-width: 980px) {
      .control-grid { grid-template-columns: 1fr; }
      .filters { grid-template-columns: 1fr; }
      .export-list { grid-template-columns: 1fr; }
    }
    `
  ]
})
export class AttendanceDashboardComponent implements OnInit {
  from = new Date().toISOString().slice(0, 10);
  to = new Date().toISOString().slice(0, 10);
  dailyDate = new Date().toISOString().slice(0, 10);
  monthlyMonth = new Date().toISOString().slice(0, 7);

  dashboard: any;
  rows: any[] = [];

  constructor(private readonly attendanceService: AttendanceService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.attendanceService
      .getDashboard({ from: this.from, to: this.to })
      .subscribe((res: any) => {
        this.dashboard = res.data;
      });

    this.attendanceService
      .getRecords({
        from: this.from,
        to: this.to,
        page: 1,
        pageSize: 20
      })
      .subscribe((res: any) => {
        this.rows = res.data?.rows || [];
      });
  }

  exportDaily(): void {
    const date = this.dailyDate || new Date().toISOString().slice(0, 10);
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
    const date = this.dailyDate || new Date().toISOString().slice(0, 10);
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
    const monthValue = monthInput || new Date().toISOString().slice(0, 7);
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
}
