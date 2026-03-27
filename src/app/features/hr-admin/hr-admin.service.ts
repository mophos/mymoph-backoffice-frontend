import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/services/api.config';

@Injectable({ providedIn: 'root' })
export class HrAdminService {
  constructor(private readonly http: HttpClient) {}

  list(search = '', page = 1, pageSize = 20): Observable<any> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (search) params = params.set('search', search);
    return this.http.get(`${API_BASE_URL}/admin/hr-office-admins`, { params, withCredentials: true });
  }

  create(payload: any): Observable<any> {
    return this.http.post(`${API_BASE_URL}/admin/hr-office-admins`, payload, { withCredentials: true });
  }

  update(userId: string, payload: any): Observable<any> {
    return this.http.put(`${API_BASE_URL}/admin/hr-office-admins/${userId}`, payload, { withCredentials: true });
  }

  deactivate(userId: string, roleCode?: string): Observable<any> {
    const params = roleCode ? new HttpParams().set('roleCode', roleCode) : undefined;
    return this.http.delete(`${API_BASE_URL}/admin/hr-office-admins/${userId}`, { params, withCredentials: true });
  }
}
