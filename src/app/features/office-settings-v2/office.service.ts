import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/services/api.config';

export interface OfficeRow {
  hcode9: string;
  code5: string | null;
  name: string;
  officeType: string | null;
  province: string | null;
  provinceCode: string | null;
  district: string | null;
  checkinStatus: 'Y' | 'N';
  /**
   * true เมื่อหน่วยงานไม่มีรหัส 5 หลัก เปิดใช้ได้แต่จะมีผลจริงเมื่อ
   * แอป MyMOPH เปลี่ยนไปอ่าน hospcode9 แล้ว
   */
  requiresAppSupport: boolean;
}

export interface OfficeListResponse {
  total: number;
  page: number;
  pageSize: number;
  rows: OfficeRow[];
}

@Injectable({ providedIn: 'root' })
export class OfficeService {
  private readonly http = inject(HttpClient);

  list(input: {
    search?: string;
    checkinStatus?: 'Y' | 'N' | '';
    page: number;
    pageSize: number;
  }): Observable<{ data: OfficeListResponse }> {
    let params = new HttpParams().set('page', input.page).set('pageSize', input.pageSize);
    if (input.search) params = params.set('search', input.search);
    if (input.checkinStatus) params = params.set('checkinStatus', input.checkinStatus);

    return this.http.get<{ data: OfficeListResponse }>(`${API_BASE_URL}/office-settings/`, {
      params,
      withCredentials: true
    });
  }

  /** เปิดหรือปิดการลงเวลา ส่ง hcode9 ได้เลย backend แปลงให้เอง */
  setCheckin(hcode9: string, enable: boolean): Observable<unknown> {
    const url = `${API_BASE_URL}/office-settings/${encodeURIComponent(hcode9)}/checkin-registration`;
    return enable
      ? this.http.post(url, {}, { withCredentials: true })
      : this.http.delete(url, { withCredentials: true });
  }
}
