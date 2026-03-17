import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/services/api.config';

export interface PersonnelRow {
  id: string;
  cid: string;
  first_name: string;
  last_name: string;
  hospcode: string;
  updated_at: string;
}

interface PersonnelListData {
  total: number;
  page: number;
  pageSize: number;
  rows: PersonnelRow[];
}

interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class PersonnelService {
  constructor(private readonly http: HttpClient) {}

  list(params: {
    search?: string;
    page: number;
    pageSize: number;
  }): Observable<ApiEnvelope<PersonnelListData>> {
    let httpParams = new HttpParams()
      .set('page', params.page)
      .set('pageSize', params.pageSize);

    if (params.search) {
      httpParams = httpParams.set('search', params.search);
    }

    return this.http.get<ApiEnvelope<PersonnelListData>>(`${API_BASE_URL}/personnel`, {
      params: httpParams,
      withCredentials: true
    });
  }

  create(payload: {
    cid: string;
    firstName: string;
    lastName: string;
    hospcode: string;
  }): Observable<ApiEnvelope<unknown>> {
    return this.http.post<ApiEnvelope<unknown>>(`${API_BASE_URL}/personnel`, payload, {
      withCredentials: true
    });
  }

  update(
    id: string,
    payload: {
      cid?: string;
      firstName?: string;
      lastName?: string;
      hospcode?: string;
    }
  ): Observable<ApiEnvelope<unknown>> {
    return this.http.put<ApiEnvelope<unknown>>(`${API_BASE_URL}/personnel/${id}`, payload, {
      withCredentials: true
    });
  }

  remove(id: string): Observable<ApiEnvelope<unknown>> {
    return this.http.delete<ApiEnvelope<unknown>>(`${API_BASE_URL}/personnel/${id}`, {
      withCredentials: true
    });
  }

  downloadTemplate(): Observable<HttpResponse<Blob>> {
    return this.http.get(`${API_BASE_URL}/personnel/template`, {
      withCredentials: true,
      responseType: 'blob',
      observe: 'response'
    });
  }

  uploadExcel(file: File): Observable<ApiEnvelope<{
    processedCount: number;
    insertedCount: number;
    updatedCount: number;
    errorCount: number;
    errors: Array<{ rowNumber: number; error: string }>;
  }>> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<ApiEnvelope<{
      processedCount: number;
      insertedCount: number;
      updatedCount: number;
      errorCount: number;
      errors: Array<{ rowNumber: number; error: string }>;
    }>>(`${API_BASE_URL}/personnel/upload`, formData, {
      withCredentials: true
    });
  }
}
