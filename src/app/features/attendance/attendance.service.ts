import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/services/api.config';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  constructor(private readonly http: HttpClient) {}

  getDashboard(params: { from: string; to: string }): Observable<any> {
    let httpParams = new HttpParams().set('from', params.from).set('to', params.to);

    return this.http.get(`${API_BASE_URL}/attendance/dashboard`, { params: httpParams, withCredentials: true });
  }

  getRecords(params: {
    from: string;
    to: string;
    page: number;
    pageSize: number;
    search?: string;
  }): Observable<any> {
    let httpParams = new HttpParams()
      .set('from', params.from)
      .set('to', params.to)
      .set('page', params.page)
      .set('pageSize', params.pageSize);

    if (params.search) httpParams = httpParams.set('search', params.search);

    return this.http.get(`${API_BASE_URL}/attendance/records`, { params: httpParams, withCredentials: true });
  }

  exportReport(params: {
    reportType: 'daily' | 'monthly';
    from: string;
    to: string;
    search?: string;
  }): Observable<HttpResponse<Blob>> {
    let httpParams = new HttpParams()
      .set('reportType', params.reportType)
      .set('from', params.from)
      .set('to', params.to);

    if (params.search) httpParams = httpParams.set('search', params.search);

    return this.http.get(`${API_BASE_URL}/attendance/export`, {
      params: httpParams,
      withCredentials: true,
      responseType: 'blob',
      observe: 'response'
    });
  }

  exportPdfReport(params: {
    reportType: 'daily' | 'monthly';
    from: string;
    to: string;
    search?: string;
  }): Observable<HttpResponse<Blob>> {
    let httpParams = new HttpParams()
      .set('reportType', params.reportType)
      .set('from', params.from)
      .set('to', params.to);

    if (params.search) httpParams = httpParams.set('search', params.search);

    return this.http.get(`${API_BASE_URL}/attendance/export-pdf`, {
      params: httpParams,
      withCredentials: true,
      responseType: 'blob',
      observe: 'response'
    });
  }
}
