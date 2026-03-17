import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/services/api.config';

export interface OfficeSettingRow {
  hospcode: string;
  name: string;
  province_code: string | null;
  is_active: number;
  checkin_status: 'Y' | 'N';
  is_checkin_registered: number;
  updated_at: string;
}

interface OfficeSettingsListData {
  total: number;
  page: number;
  pageSize: number;
  rows: OfficeSettingRow[];
}

interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class OfficeSettingsService {
  constructor(private readonly http: HttpClient) {}

  list(params: {
    search?: string;
    isActive?: '0' | '1' | 'all';
    page: number;
    pageSize: number;
  }): Observable<ApiEnvelope<OfficeSettingsListData>> {
    let httpParams = new HttpParams()
      .set('page', params.page)
      .set('pageSize', params.pageSize);

    if (params.search) {
      httpParams = httpParams.set('search', params.search);
    }

    if (params.isActive && params.isActive !== 'all') {
      httpParams = httpParams.set('isActive', params.isActive);
    }

    return this.http.get<ApiEnvelope<OfficeSettingsListData>>(`${API_BASE_URL}/office-settings`, {
      params: httpParams,
      withCredentials: true
    });
  }

  create(payload: {
    hospcode: string;
    name: string;
    province_code?: string | null;
    is_active?: 0 | 1;
  }): Observable<ApiEnvelope<unknown>> {
    return this.http.post<ApiEnvelope<unknown>>(`${API_BASE_URL}/office-settings`, payload, { withCredentials: true });
  }

  update(
    hospcode: string,
    payload: {
      name?: string;
      province_code?: string | null;
      is_active?: 0 | 1;
    }
  ): Observable<ApiEnvelope<unknown>> {
    return this.http.put<ApiEnvelope<unknown>>(`${API_BASE_URL}/office-settings/${hospcode}`, payload, {
      withCredentials: true
    });
  }

  remove(hospcode: string): Observable<ApiEnvelope<unknown>> {
    return this.http.delete<ApiEnvelope<unknown>>(`${API_BASE_URL}/office-settings/${hospcode}`, {
      withCredentials: true
    });
  }

  registerCheckinOffice(hospcode: string): Observable<ApiEnvelope<unknown>> {
    return this.http.post<ApiEnvelope<unknown>>(
      `${API_BASE_URL}/office-settings/${hospcode}/checkin-registration`,
      {},
      { withCredentials: true }
    );
  }
}
