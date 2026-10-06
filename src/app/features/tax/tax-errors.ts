/**
 * ข้อความ error ของโมดูลภาษี
 *
 * เดิมตารางนี้ฝังอยู่ในคอมโพเนนต์เดียวที่ทำทุกอย่าง เมื่อแยกเป็นสี่หน้า
 * ทุกหน้าต้องแปลรหัสเดียวกันให้ได้ข้อความเดียวกัน จึงย้ายออกมาไว้ที่เดียว
 * รหัสและข้อความคงเดิมทุกตัว ไม่ได้เพิ่มหรือตัดออก
 */
const ERROR_TEXT: Record<string, string> = {
  INVALID_YEAR_BE: 'ปี พ.ศ. ไม่ถูกต้อง',
  TAX_YEAR_ALREADY_EXISTS: 'ปี พ.ศ. นี้มีอยู่แล้ว',
  HOSPCODE_REQUIRED: 'กรุณาระบุ Hospcode',
  HOSPCODE_NOT_FOUND: 'ไม่พบรหัสหน่วยงานนี้ในทะเบียนกลาง',
  OFFICE_WITHOUT_CODE5: 'หน่วยงานนี้ยังไม่มีรหัส 5 หลัก จึงยังสร้างปีภาษีไม่ได้',
  TAX_YEAR_NOT_FOUND: 'ไม่พบปี พ.ศ. ที่เลือก',
  TAX_DOCUMENT_NOT_FOUND: 'ไม่พบรายการไฟล์',
  SCOPE_FORBIDDEN: 'ไม่มีสิทธิ์เข้าถึงข้อมูลหน่วยงานนี้',
  FORBIDDEN: 'ไม่มีสิทธิ์เข้าถึงข้อมูลส่วนนี้',
  INVALID_CID: 'เลขบัตรต้องเป็นตัวเลข 13 หลัก',
  CID_OR_FILE_MISSING: 'กรุณากรอกเลขบัตรและเลือกไฟล์ให้ครบทุกแถว',
  NO_UPLOAD_ITEMS: 'กรุณาเพิ่มรายการที่จะอัปโหลดอย่างน้อย 1 รายการ',
  EMPTY_UPLOAD_ITEMS: 'กรุณาเพิ่มรายการที่จะอัปโหลดอย่างน้อย 1 รายการ',
  FILES_AND_CIDS_REQUIRED: 'กรุณาเลือกไฟล์ PDF และระบุ CID ให้ครบ',
  FILES_CIDS_LENGTH_MISMATCH: 'จำนวนไฟล์ PDF และ CID ไม่เท่ากัน',
  PDF_AND_TXT_REQUIRED: 'กรุณาเลือกไฟล์ PDF และ TXT',
  PDF_PAGE_COUNT_MISMATCH_TXT_LINES: 'จำนวนหน้า PDF ไม่เท่าจำนวนบรรทัดใน TXT',
  TXT_PATTERN_INVALID: 'รูปแบบไฟล์ TXT ไม่ถูกต้องตาม pattern ที่กำหนด',
  EMPTY_TXT_FILE: 'ไฟล์ TXT ว่างหรือไม่มีข้อมูลที่ใช้งานได้',
  ONLY_PDF_ALLOWED: 'รองรับเฉพาะไฟล์ PDF',
  INVALID_PDF_FILE: 'ไฟล์ PDF ไม่ถูกต้องหรือเปิดอ่านไม่ได้',
  INVALID_TXT_FILE: 'กรุณาเลือกไฟล์ TXT เท่านั้น',
  INDIVIDUAL_PDF_MUST_HAVE_SINGLE_PAGE: 'ไฟล์ PDF แบบรายบุคคลต้องมี 1 หน้าเท่านั้น',
  EMPTY_UPDATE_PAYLOAD: 'ยังไม่มีข้อมูลที่ต้องการแก้ไข',
  FILE_NOT_FOUND: 'ไม่พบไฟล์ในระบบจัดเก็บ',
  PREVIEW_RESPONSE_MISMATCH: 'ข้อมูลตัวอย่างไม่ครบถ้วน กรุณาลองใหม่อีกครั้ง',
  NO_PREVIEW_TO_CONFIRM: 'ยังไม่มีตัวอย่างสำหรับยืนยันบันทึก',
  INVALID_PREVIEW_PAGE: 'ไม่สามารถเปิดหน้า PDF ตัวอย่างที่เลือกได้',
  OPEN_PREVIEW_POPUP_BLOCKED: 'เบราว์เซอร์บล็อกการเปิดแท็บใหม่ กรุณาอนุญาต pop-up สำหรับเว็บไซต์นี้',
  EMPTY_DOWNLOAD_FILE: 'ไฟล์ที่ได้จากระบบว่างเปล่า',
  LOAD_TAX_YEARS_FAILED: 'โหลดรายการปีภาษีไม่สำเร็จ',
  LOAD_TAX_DOCUMENTS_FAILED: 'โหลดรายการไฟล์ไม่สำเร็จ',
  SEARCH_CRITERIA_REQUIRED: 'ต้องใส่คำค้น หรือเลือกปี อย่างน้อยหนึ่งอย่าง',
  INVALID_SEARCH_QUERY: 'เงื่อนไขการค้นหาไม่ถูกต้อง',
  CREATE_TAX_YEAR_FAILED: 'เพิ่มปีภาษีไม่สำเร็จ',
  DELETE_TAX_YEAR_FAILED: 'ลบปีภาษีไม่สำเร็จ',
  DELETE_TAX_DOCUMENT_FAILED: 'ลบไฟล์ไม่สำเร็จ',
  DOWNLOAD_TAX_FILE_FAILED: 'เปิดไฟล์ไม่สำเร็จ',
  PREVIEW_INDIVIDUAL_FAILED: 'ตรวจสอบไฟล์รายบุคคลไม่สำเร็จ',
  PREVIEW_BATCH_FAILED: 'ตรวจสอบไฟล์แบบเป็นชุดไม่สำเร็จ',
  UPLOAD_INDIVIDUAL_FAILED: 'บันทึกไฟล์รายบุคคลไม่สำเร็จ',
  UPLOAD_BATCH_FAILED: 'บันทึกไฟล์แบบเป็นชุดไม่สำเร็จ'
};

/** แปลรหัสเป็นข้อความไทย รหัสที่ไม่รู้จักยังแสดงรหัสให้เห็นเพื่อแจ้งปัญหาได้ */
export function taxErrorText(errorCode: string): string {
  return ERROR_TEXT[errorCode] ?? `เกิดข้อผิดพลาด: ${errorCode}`;
}

/**
 * ดึงรหัส error ออกจาก response ที่ backend ส่งมา
 *
 * backend ตอบ { ok: false, error: 'CODE' } แต่ HttpErrorResponse ห่อไว้หลายชั้น
 * และบางเส้นทาง (ดาวน์โหลดไฟล์ที่ responseType เป็น blob) ได้ body เป็นสตริง JSON
 */
export function resolveTaxErrorCode(error: unknown, fallbackCode: string): string {
  if (!error) return fallbackCode;
  if (typeof error === 'string') return error;

  const source = error as { error?: unknown; message?: unknown };
  const payload = source.error ?? error;

  /*
   * body ที่เป็น Blob อ่านแบบ synchronous ไม่ได้ และข้อความ message ของ
   * HttpErrorResponse เป็นภาษาอังกฤษแบบดิบ ไม่ควรเอาไปแสดงให้ผู้ใช้
   * เส้นที่ใช้ responseType blob แปลงให้แล้วที่ TaxService ตรงนี้กันไว้ชั้นสุดท้าย
   */
  if (typeof Blob !== 'undefined' && payload instanceof Blob) {
    return fallbackCode;
  }

  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload) as { error?: unknown };
      if (typeof parsed?.error === 'string') return parsed.error;
    } catch {
      if (payload.trim().length > 0) return payload;
    }
    return fallbackCode;
  }

  if (payload && typeof payload === 'object') {
    const body = payload as { error?: unknown; message?: unknown };
    if (typeof body.error === 'string' && body.error.trim()) return body.error;
    if (typeof body.message === 'string' && body.message.trim()) return body.message;
  }

  if (typeof source.message === 'string' && source.message.trim()) return source.message;

  return fallbackCode;
}

/** แปลง error ที่ได้จาก API ให้เป็นข้อความพร้อมแสดง */
export function taxApiErrorText(error: unknown, fallbackCode: string): string {
  return taxErrorText(resolveTaxErrorCode(error, fallbackCode));
}

/**
 * รับปี พ.ศ. ทั้งแบบสองหลักและสี่หลัก
 *
 * ผู้ใช้พิมพ์ 68 แทน 2568 เป็นปกติ กฎนี้ต้องเหมือนฝั่ง backend
 * ซึ่งรับช่วง 2500-3000 หลังแปลงแล้ว
 */
export function normalizeYearBe(input: string | number | null | undefined): number | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  const year = Number(raw);
  if (!Number.isInteger(year) || year < 0) return null;

  const yearBe = year < 100 ? 2500 + year : year;
  if (yearBe < 2500 || yearBe > 3000) return null;

  return yearBe;
}

/** สองหลักท้ายของปี พ.ศ. ที่ใช้ขึ้นต้นชื่อไฟล์ */
export function yearShort(yearBe: number | null | undefined): string {
  if (yearBe === null || yearBe === undefined || !Number.isInteger(Number(yearBe))) return 'YY';
  return String(Number(yearBe) % 100).padStart(2, '0');
}

export function isPdfFile(file: File): boolean {
  const filename = String(file.name || '').toLowerCase();
  const mime = String(file.type || '').toLowerCase();
  return mime === 'application/pdf' || filename.endsWith('.pdf');
}

export function isTxtFile(file: File): boolean {
  const filename = String(file.name || '').toLowerCase();
  const mime = String(file.type || '').toLowerCase();
  return mime === 'text/plain' || filename.endsWith('.txt');
}
