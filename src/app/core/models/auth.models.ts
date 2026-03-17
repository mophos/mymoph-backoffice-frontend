export type PermissionCode =
  | 'attendance.read'
  | 'attendance.export'
  | 'personnel.read'
  | 'personnel.manage'
  | 'payroll.read'
  | 'payroll.export'
  | 'office_settings.read'
  | 'office_settings.update'
  | 'user_admin.manage'
  | 'role_admin.manage';

export interface MenuItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  module: string;
  requiredPermissions: PermissionCode[];
}

export interface CurrentUser {
  id: string;
  cid: string;
  displayName?: string;
  roles: string[];
  permissions: PermissionCode[];
  scopeType: 'ALL' | 'LIST';
  hospcodes: string[];
  allowedModules: string[];
  menus: MenuItem[];
}

export interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  error?: string;
}
