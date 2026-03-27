import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/services/api.config';
import { ApiEnvelope } from '../../core/models/auth.models';

export interface TaxYearRow {
  id: number;
  yearBe: number;
  yearShort: string;
  hospcode: string;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaxDocumentRow {
  id: string;
  tax_year_id: number;
  hospcode: string;
  cid: string;
  file_no: number;
  file_name: string;
  original_file_name?: string;
  source_type: 'single' | 'batch';
  created_at: string;
  updated_at: string;
}

interface ListDocumentsData {
  year: {
    id: number;
    yearBe: number;
    yearShort: string;
    hospcode: string;
  };
  total: number;
  page: number;
  pageSize: number;
  rows: TaxDocumentRow[];
}

export interface IndividualUploadPreviewRow {
  cid: string;
  fileNo: number;
  fileName: string;
  originalFileName: string;
  pageCount: number;
}

export interface BatchUploadPreviewRow {
  pageNo: number;
  cid: string;
  fileNo: number;
  fileName: string;
}

@Injectable({ providedIn: 'root' })
export class TaxService {
  constructor(private readonly http: HttpClient) {}

  listYears(): Observable<ApiEnvelope<TaxYearRow[]>> {
    return this.http.get<ApiEnvelope<TaxYearRow[]>>(`${API_BASE_URL}/tax/years`, {
      withCredentials: true
    });
  }

  createYear(payload: { yearBe: number; hospcode?: string }): Observable<ApiEnvelope<unknown>> {
    return this.http.post<ApiEnvelope<unknown>>(`${API_BASE_URL}/tax/years`, payload, {
      withCredentials: true
    });
  }

  updateYear(id: number, payload: { yearBe: number; hospcode?: string }): Observable<ApiEnvelope<unknown>> {
    return this.http.put<ApiEnvelope<unknown>>(`${API_BASE_URL}/tax/years/${id}`, payload, {
      withCredentials: true
    });
  }

  deleteYear(id: number): Observable<ApiEnvelope<unknown>> {
    return this.http.delete<ApiEnvelope<unknown>>(`${API_BASE_URL}/tax/years/${id}`, {
      withCredentials: true
    });
  }

  listDocuments(params: {
    yearId: number;
    search?: string;
    page: number;
    pageSize: number;
  }): Observable<ApiEnvelope<ListDocumentsData>> {
    let httpParams = new HttpParams().set('page', params.page).set('pageSize', params.pageSize);

    if (params.search) {
      httpParams = httpParams.set('search', params.search);
    }

    return this.http.get<ApiEnvelope<ListDocumentsData>>(`${API_BASE_URL}/tax/years/${params.yearId}/documents`, {
      params: httpParams,
      withCredentials: true
    });
  }

  uploadIndividual(yearId: number, items: Array<{ cid: string; file: File }>): Observable<ApiEnvelope<{ createdCount: number }>> {
    const formData = new FormData();
    items.forEach((item) => {
      formData.append('cids', item.cid);
      formData.append('files', item.file, item.file.name);
    });

    return this.http.post<ApiEnvelope<{ createdCount: number }>>(
      `${API_BASE_URL}/tax/years/${yearId}/upload-individual`,
      formData,
      { withCredentials: true }
    );
  }

  previewUploadIndividual(
    yearId: number,
    items: Array<{ cid: string; file: File }>
  ): Observable<ApiEnvelope<{ rows: IndividualUploadPreviewRow[] }>> {
    const formData = new FormData();
    items.forEach((item) => {
      formData.append('cids', item.cid);
      formData.append('files', item.file, item.file.name);
    });

    return this.http.post<ApiEnvelope<{ rows: IndividualUploadPreviewRow[] }>>(
      `${API_BASE_URL}/tax/years/${yearId}/upload-individual/preview`,
      formData,
      { withCredentials: true }
    );
  }

  uploadBatch(
    yearId: number,
    pdf: File,
    txt: File
  ): Observable<ApiEnvelope<{ createdCount: number; pageCount: number; lineCount: number; delimiter: string }>> {
    const formData = new FormData();
    formData.append('pdf', pdf, pdf.name);
    formData.append('txt', txt, txt.name);

    return this.http.post<ApiEnvelope<{ createdCount: number; pageCount: number; lineCount: number; delimiter: string }>>(
      `${API_BASE_URL}/tax/years/${yearId}/upload-batch`,
      formData,
      { withCredentials: true }
    );
  }

  previewUploadBatch(
    yearId: number,
    pdf: File,
    txt: File
  ): Observable<ApiEnvelope<{ rows: BatchUploadPreviewRow[]; pageCount: number; lineCount: number; delimiter: string }>> {
    const formData = new FormData();
    formData.append('pdf', pdf, pdf.name);
    formData.append('txt', txt, txt.name);

    return this.http.post<ApiEnvelope<{ rows: BatchUploadPreviewRow[]; pageCount: number; lineCount: number; delimiter: string }>>(
      `${API_BASE_URL}/tax/years/${yearId}/upload-batch/preview`,
      formData,
      { withCredentials: true }
    );
  }

  downloadDocument(id: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${API_BASE_URL}/tax/documents/${id}/download`, {
      withCredentials: true,
      responseType: 'blob',
      observe: 'response'
    });
  }

  updateDocument(id: string, payload: { cid?: string; file?: File }): Observable<ApiEnvelope<unknown>> {
    const formData = new FormData();
    if (payload.cid) {
      formData.append('cid', payload.cid);
    }
    if (payload.file) {
      formData.append('file', payload.file, payload.file.name);
    }

    return this.http.put<ApiEnvelope<unknown>>(`${API_BASE_URL}/tax/documents/${id}`, formData, {
      withCredentials: true
    });
  }

  deleteDocument(id: string): Observable<ApiEnvelope<unknown>> {
    return this.http.delete<ApiEnvelope<unknown>>(`${API_BASE_URL}/tax/documents/${id}`, {
      withCredentials: true
    });
  }
}
