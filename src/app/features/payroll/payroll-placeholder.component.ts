import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../../core/services/api.config';

interface PayrollSummaryRow {
  hospcode: string;
  pay_month: string;
  status: string;
}

/**
 * ยังไม่ได้เขียนหน้าจริง รอบนี้ปรับเฉพาะหัวข้อให้เข้าชุดกับเมนูที่เขียนใหม่แล้ว
 *
 * ยังเรียก /payroll/summary เหมือนเดิมเพื่อพิสูจน์ว่า guard และ scope filter
 * ทำงานครบเส้นทาง ปัจจุบัน payroll_runs ยังไม่มีข้อมูลสักแถว
 */
@Component({
  selector: 'app-payroll-placeholder',
  templateUrl: './payroll-placeholder.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PayrollPlaceholderComponent {
  private readonly http = inject(HttpClient);

  readonly rows = signal<PayrollSummaryRow[]>([]);
  readonly loaded = signal(false);

  constructor() {
    this.http
      .get<{ data?: PayrollSummaryRow[] }>(`${API_BASE_URL}/payroll/summary`, { withCredentials: true })
      .subscribe({
        next: (res) => {
          this.rows.set(res?.data ?? []);
          this.loaded.set(true);
        },
        error: () => this.loaded.set(true)
      });
  }
}
