import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/services/api.config';

/** หน่วยงานจากทะเบียนกลาง backend ส่งมาคู่กับ hospcodes เดิม */
export interface OfficeRef {
  code5: string;
  hcode9: string;
  name: string;
}

export interface FinanceAdminRow {
  user_id: string;
  cid: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  role_codes: string[];
  /** รหัส 5 หลักตามที่เก็บใน user_office_scope ยังไม่ย้ายไป hcode9 */
  hospcodes: string[];
  offices?: OfficeRef[];
}

export interface FinanceAdminPayload {
  cid: string;
  hospcodes: string[];
}

interface ListResponse {
  data: { rows: FinanceAdminRow[]; total: number };
}

@Injectable({ providedIn: 'root' })
export class FinanceAdminService {
  private readonly http = inject(HttpClient);

  list(search = '', page = 1, pageSize = 20): Observable<ListResponse> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (search) params = params.set('search', search);
    return this.http.get<ListResponse>(`${API_BASE_URL}/admin/finance-office-admins`, {
      params,
      withCredentials: true
    });
  }

  create(payload: FinanceAdminPayload): Observable<unknown> {
    return this.http.post(`${API_BASE_URL}/admin/finance-office-admins`, payload, {
      withCredentials: true
    });
  }

  update(userId: string, payload: FinanceAdminPayload): Observable<unknown> {
    return this.http.put(`${API_BASE_URL}/admin/finance-office-admins/${userId}`, payload, {
      withCredentials: true
    });
  }

  deactivate(userId: string): Observable<unknown> {
    return this.http.delete(`${API_BASE_URL}/admin/finance-office-admins/${userId}`, {
      withCredentials: true
    });
  }
}
