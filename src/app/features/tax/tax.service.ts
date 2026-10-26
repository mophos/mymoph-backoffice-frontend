import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, catchError, from, switchMap, throwError } from 'rxjs';
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

/** แถวผลค้นหาข้ามปี ต้องมีปีกับหน่วยงานกำกับ ไม่งั้นดูไม่ออกว่ามาจากไหน */
export interface TaxSearchRow {
  id: string;
  taxYearId: number;
  yearBe: number;
  yearShort: string;
  /** ปีที่เอกสารบันทึกไว้เอง ต่างจาก yearBe ได้ถ้าข้อมูลเก่าไม่สอดคล้อง */
  documentYearBe: number;
  hospcode: string;
  cid: string;
  fileNo: number;
  fileName: string;
  originalFileName: string | null;
  sourceType: string;
  updatedAt: string;
}

interface SearchDocumentsData {
  total: number;
  page: number;
  pageSize: number;
  rows: TaxSearchRow[];
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

export interface CreateTaxYearData {
  id: number;
  yearBe: number;
  yearShort: string;
  hospcode: string;
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

/**
 * ผลการลบที่ backend ส่งกลับมา — TAX-02 / TAX-16
 *
 * การลบไฟล์ไม่ทำให้คำขอล้มเหลวอีกแล้ว แต่ถ้าลบไฟล์ไม่สำเร็จต้องบอกผู้ใช้
 * ไม่งั้นจะเหลือไฟล์ค้างบนดิสก์โดยไม่มีใครรู้ ซึ่งเป็นที่มาของไฟล์ค้าง 2,072 ไฟล์
 */
export interface DeleteYearResult {
  documentsDeleted: number;
  filesRemoved: number;
  filesFailed: number;
}

export interface DeleteDocumentResult {
  fileRemoved: boolean;
}

@Injectable({ providedIn: 'root' })
/*
 * endpoint ที่ backend มีแต่ฝั่งหน้าเว็บไม่เรียก จึงไม่ประกาศเมธอดไว้ที่นี่
 *
 *   PUT /tax/years/:id · PUT /tax/documents/:id
 *     ตอบ 403 TAX_*_EDIT_DISABLED อยู่แล้ว ข้อกำหนดคือไฟล์ที่บันทึกแล้วแก้ไขไม่ได้
 *     ต้องลบแล้วอัปโหลดใหม่เพื่อให้มีร่องรอยการลบทุกครั้ง
 *
 *   GET /tax/years/:id/yearly-overview
 *     สรุปรายคนทั้งปี เคยมีหน้า /tax-overview เรียกใช้ ถอดออก 5 ต.ค. 2569
 *     เพราะมีผู้ใช้จริงเรียกครั้งเดียวในประวัติ และข้อมูลที่มันตอบได้
 *     (คนที่มีไฟล์ข้ามหน่วยงาน) เป็น 0.33% ของทั้งหมด
 *     endpoint ยังอยู่และยังบังคับ scope ตาม TAX-03/D-20
 */
export class TaxService {
  constructor(private readonly http: HttpClient) {}

  listYears(hospcodeSearch?: string): Observable<ApiEnvelope<TaxYearRow[]>> {
    let params = new HttpParams();
    if (hospcodeSearch) {
      params = params.set('hospcode', hospcodeSearch);
    }

    return this.http.get<ApiEnvelope<TaxYearRow[]>>(`${API_BASE_URL}/tax/years`, {
      params,
      withCredentials: true
    });
  }

  createYear(payload: { yearBe: number; hospcode?: string }): Observable<ApiEnvelope<CreateTaxYearData>> {
    return this.http.post<ApiEnvelope<CreateTaxYearData>>(`${API_BASE_URL}/tax/years`, payload, {
      withCredentials: true
    });
  }

  deleteYear(id: number): Observable<ApiEnvelope<DeleteYearResult>> {
    return this.http.delete<ApiEnvelope<DeleteYearResult>>(`${API_BASE_URL}/tax/years/${id}`, {
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

  /**
   * ค้นไฟล์ข้ามปีและข้ามหน่วยงาน
   *
   * ต่างจาก listDocuments ที่ล็อกอยู่ปีเดียว ใช้ตอนรู้เลขบัตรแต่ไม่รู้ว่าอยู่ปีไหน
   * backend บังคับให้มีเงื่อนไขอย่างน้อยหนึ่งอย่าง ไม่งั้นตอบ SEARCH_CRITERIA_REQUIRED
   */
  searchDocuments(params: {
    search?: string;
    yearBe?: number;
    hospcode?: string;
    page: number;
    pageSize: number;
  }): Observable<ApiEnvelope<SearchDocumentsData>> {
    let httpParams = new HttpParams().set('page', params.page).set('pageSize', params.pageSize);

    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.yearBe !== undefined) httpParams = httpParams.set('yearBe', params.yearBe);
    if (params.hospcode) httpParams = httpParams.set('hospcode', params.hospcode);

    return this.http.get<ApiEnvelope<SearchDocumentsData>>(`${API_BASE_URL}/tax/documents`, {
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

  /**
   * โหลดไฟล์มาเปิดในแท็บใหม่
   *
   * ต้องใช้ responseType blob เพราะ backend ส่งไฟล์มา แต่ผลข้างเคียงคือ
   * **ตอนเกิด error body ก็มาเป็น Blob ด้วย** ไม่ใช่ JSON ที่อ่านรหัสได้
   * ผลคือหน้าเว็บเคยขึ้นข้อความดิบของ Angular ว่า
   * "Http failure response for ...: 404 Not Found" แทนข้อความไทย
   *
   * จึงแปลง Blob เป็น JSON ให้เสร็จที่นี่ ผู้เรียกทุกรายจะได้ error
   * รูปแบบเดียวกับ endpoint อื่นและแปลเป็นข้อความไทยได้ตามปกติ
   */
  downloadDocument(id: string): Observable<HttpResponse<Blob>> {
    return this.http
      .get(`${API_BASE_URL}/tax/documents/${id}/download`, {
        withCredentials: true,
        responseType: 'blob',
        observe: 'response'
      })
      .pipe(catchError((error: HttpErrorResponse) => this.rethrowWithReadableBody(error)));
  }

  private rethrowWithReadableBody(error: HttpErrorResponse): Observable<never> {
    if (!(error.error instanceof Blob)) {
      return throwError(() => error);
    }

    return from(error.error.text()).pipe(
      switchMap((text) => {
        let body: unknown = text;
        try {
          body = JSON.parse(text);
        } catch {
          // ไม่ใช่ JSON ก็ส่งข้อความดิบไป ดีกว่าทิ้งทั้งก้อน
        }

        return throwError(
          () =>
            new HttpErrorResponse({
              error: body,
              headers: error.headers,
              status: error.status,
              statusText: error.statusText,
              url: error.url ?? undefined
            })
        );
      })
    );
  }

  deleteDocument(id: string): Observable<ApiEnvelope<DeleteDocumentResult>> {
    return this.http.delete<ApiEnvelope<DeleteDocumentResult>>(`${API_BASE_URL}/tax/documents/${id}`, {
      withCredentials: true
    });
  }
}
