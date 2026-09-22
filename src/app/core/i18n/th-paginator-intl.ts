import { MatPaginatorIntl } from '@angular/material/paginator';

/**
 * Angular Material ให้ label ของ paginator มาเป็นภาษาอังกฤษเท่านั้น
 * เช่น "Items per page" และ "1 – 20 of 57"
 */
export function thPaginatorIntl(): MatPaginatorIntl {
  const intl = new MatPaginatorIntl();

  intl.itemsPerPageLabel = 'แสดงต่อหน้า';
  intl.nextPageLabel = 'หน้าถัดไป';
  intl.previousPageLabel = 'หน้าก่อนหน้า';
  intl.firstPageLabel = 'หน้าแรก';
  intl.lastPageLabel = 'หน้าสุดท้าย';

  intl.getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0) {
      return 'ไม่พบข้อมูล';
    }

    const total = Math.max(length, 0);
    const start = page * pageSize;
    // ระวังกรณี start เกิน length ซึ่งเกิดได้เมื่อข้อมูลลดลงหลังลบรายการ
    const end = start < total ? Math.min(start + pageSize, total) : start + pageSize;

    return `${start + 1}–${end} จาก ${total} รายการ`;
  };

  return intl;
}
