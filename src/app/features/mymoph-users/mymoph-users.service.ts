import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/services/api.config';
import type { ApiEnvelope } from '../../core/models/auth.models';

export interface MymophUserRow {
  id: string;
  cidMasked: string;
  email: string;
  isKyc: 'Y' | 'N' | 'UNKNOWN';
  firstName: string;
  lastName: string;
}

interface MymophUsersListData {
  total: number;
  page: number;
  pageSize: number;
  rows: MymophUserRow[];
}

@Injectable({ providedIn: 'root' })
export class MymophUsersService {
  constructor(private readonly http: HttpClient) {}

  list(input: {
    search: string;
    page: number;
    pageSize: number;
  }): Observable<ApiEnvelope<MymophUsersListData>> {
    const params = new HttpParams()
      .set('search', input.search)
      .set('page', input.page)
      .set('pageSize', input.pageSize);

    return this.http.get<ApiEnvelope<MymophUsersListData>>(`${API_BASE_URL}/mymoph-users`, {
      params,
      withCredentials: true
    });
  }

  verifyHr(id: string): Observable<ApiEnvelope<{ found: boolean }>> {
    return this.http.get<ApiEnvelope<{ found: boolean }>>(`${API_BASE_URL}/mymoph-users/${id}/hr-status`, {
      withCredentials: true
    });
  }

  archiveDelete(id: string, reason: string): Observable<ApiEnvelope<{ archiveId: string }>> {
    return this.http.post<ApiEnvelope<{ archiveId: string }>>(
      `${API_BASE_URL}/mymoph-users/${id}/archive-delete`,
      { reason },
      { withCredentials: true }
    );
  }
}
