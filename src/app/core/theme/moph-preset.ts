import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * สีหลักอิงจาก --brand: #0f766e ใน styles.css ของระบบเดิม
 * ไล่เฉดเต็มสเกลเพื่อให้ component ของ PrimeNG ที่ใช้เฉดอ่อน/เข้ม
 * (hover, focus ring, badge, ปุ่ม text) มีสีที่เข้าชุดกัน
 */
export const MophPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#f0fdfa',
      100: '#ccfbf1',
      200: '#99f6e4',
      300: '#5eead4',
      400: '#2dd4bf',
      500: '#14b8a6',
      600: '#0d9488',
      700: '#0f766e',
      800: '#115e59',
      900: '#134e4a',
      950: '#042f2e'
    }
  }
});

/** label ของ PrimeNG ตั้งต้นเป็นภาษาอังกฤษทั้งหมด จึงต้องกำหนดเอง */
export const thTranslation = {
  accept: 'ตกลง',
  reject: 'ยกเลิก',
  choose: 'เลือกไฟล์',
  upload: 'อัปโหลด',
  cancel: 'ยกเลิก',
  clear: 'ล้าง',
  apply: 'ใช้งาน',
  today: 'วันนี้',
  emptyMessage: 'ไม่พบข้อมูล',
  emptyFilterMessage: 'ไม่พบข้อมูลที่ตรงกับเงื่อนไข',
  emptySelectionMessage: 'ยังไม่ได้เลือกรายการ',
  emptySearchMessage: 'ไม่พบผลการค้นหา',
  searchMessage: 'พิมพ์เพื่อค้นหา',
  firstDayOfWeek: 0,
  dayNames: ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'],
  dayNamesShort: ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'],
  dayNamesMin: ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'],
  monthNames: [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ],
  monthNamesShort: [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ],
  dateFormat: 'dd/mm/yy',
  weekHeader: 'สัปดาห์'
};
