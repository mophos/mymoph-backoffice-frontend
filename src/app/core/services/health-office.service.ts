import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from './api.config';

export interface HealthOffice {
  hcode9: string;
  /** null เมื่อหน่วยงานนี้ไม่มีรหัส 5 หลัก พบมากในสถานพยาบาลเอกชน */
  code5: string | null;
  name: string;
  officeType: string | null;
  province: string | null;
  provinceCode: string | null;
  district: string | null;
  active: boolean;
}

@Injectable({ providedIn: 'root' })
export class HealthOfficeService {
  private readonly http = inject(HttpClient);

  search(search: string, pageSize = 20): Observable<HealthOffice[]> {
    let params = new HttpParams().set('pageSize', pageSize);
    if (search) params = params.set('search', search);

    return this.http
      .get<{ data: { rows: HealthOffice[] } }>(`${API_BASE_URL}/health-offices`, {
        params,
        withCredentials: true
      })
      .pipe(map((res) => res?.data?.rows ?? []));
  }

  /** แปลงรหัสที่บันทึกไว้แล้วให้เป็นชื่อ ใช้ตอนเปิดฟอร์มแก้ไข */
  resolve(codes: { hcode9?: string[]; code5?: string[] }): Observable<HealthOffice[]> {
    return this.http
      .post<{ data: { rows: HealthOffice[] } }>(`${API_BASE_URL}/health-offices/resolve`, codes, {
        withCredentials: true
      })
      .pipe(map((res) => res?.data?.rows ?? []));
  }
}
