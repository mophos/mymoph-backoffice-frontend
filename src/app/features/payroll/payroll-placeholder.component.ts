import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { API_BASE_URL } from '../../core/services/api.config';

@Component({
    selector: 'app-payroll-placeholder',
    imports: [],
    template: `
    <section class="card">
      <h2>Payroll (Phase 2)</h2>
      <p>โครงพร้อมแล้ว: route guard + permission check + scope filter</p>
    
      <ul>
        @for (item of rows; track item) {
          <li>{{ item.hospcode }} | {{ item.pay_month }} | {{ item.status }}</li>
        }
      </ul>
    </section>
    `,
    styles: ['.card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 18px; }']
})
export class PayrollPlaceholderComponent implements OnInit {
  rows: any[] = [];

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<any>(`${API_BASE_URL}/payroll/summary`, { withCredentials: true }).subscribe((res) => {
      this.rows = res.data || [];
    });
  }
}
