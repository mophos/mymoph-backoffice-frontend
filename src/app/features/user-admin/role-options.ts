export interface RoleOption {
  code: string;
  label: string;
  /** อธิบายว่าบทบาทนี้เข้าเมนูอะไรได้ คนมอบสิทธิ์ไม่ควรต้องจำเอง */
  description: string;
  /** ต้องมี role_admin.manage จึงจะมอบได้ */
  restricted?: boolean;
}

export const ROLE_OPTIONS: RoleOption[] = [
  { code: 'hr', label: 'บุคลากร', description: 'ลงเวลาเข้าออกงาน และข้อมูลบุคลากร รวมเพิ่ม แก้ไข นำเข้า' },
  { code: 'admin_affairs', label: 'การเงิน', description: 'เงินเดือน และใบรับรองภาษี รวมอัปโหลดและลบเอกสาร' },
  { code: 'it_office', label: 'ไอที', description: 'ตั้งค่าหน่วยงาน และลงทะเบียนลงเวลา' },
  { code: 'user_mymoph', label: 'ดูแลผู้ใช้ MyMOPH', description: 'ค้นหา ตรวจสอบ และลบบัญชีผู้ใช้แอป MyMOPH' },
  { code: 'super_admin_affairs', label: 'ผู้ดูแลการเงิน', description: 'แต่งตั้งเจ้าหน้าที่การเงินผ่านหน้าผู้ใช้และสิทธิ์: การเงิน' },
  { code: 'super_admin', label: 'ผู้ดูแลระบบ', description: 'เข้าได้ทุกเมนูยกเว้นผู้ใช้และสิทธิ์: การเงิน และมีขอบเขตทุกหน่วยงาน', restricted: true }
];

export function roleLabels(codes: string[]): string {
  if (!codes.length) return 'ไม่มี';
  return codes.map((code) => ROLE_OPTIONS.find((o) => o.code === code)?.label ?? code).join(', ');
}
