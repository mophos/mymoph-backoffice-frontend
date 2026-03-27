import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { ShellComponent } from './layout/shell.component';
import { LoginComponent } from './features/auth/login.component';
import { AuthCallbackComponent } from './features/auth/auth-callback.component';
import { UnauthorizedComponent } from './features/shared/unauthorized.component';
import { NotFoundComponent } from './features/shared/not-found.component';
import { AttendanceDashboardComponent } from './features/attendance/attendance-dashboard.component';
import { HrAdminManagementComponent } from './features/hr-admin/hr-admin-management.component';
import { PersonnelManagementComponent } from './features/personnel/personnel-management.component';
import { PayrollPlaceholderComponent } from './features/payroll/payroll-placeholder.component';
import { TaxManagementComponent } from './features/tax/tax-management.component';
import { OfficeSettingsComponent } from './features/office-settings/office-settings.component';

export const appRoutes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'auth/callback', component: AuthCallbackComponent },
  { path: 'unauthorized', component: UnauthorizedComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'attendance',
        component: AttendanceDashboardComponent,
        canActivate: [permissionGuard],
        data: { permission: 'attendance.read' }
      },
      {
        path: 'hr-admin',
        component: HrAdminManagementComponent,
        canActivate: [permissionGuard],
        data: { permission: 'user_admin.manage' }
      },
      {
        path: 'personnel',
        component: PersonnelManagementComponent,
        canActivate: [permissionGuard],
        data: { permission: 'personnel.read' }
      },
      {
        path: 'payroll',
        component: PayrollPlaceholderComponent,
        canActivate: [permissionGuard],
        data: { permission: 'payroll.read' }
      },
      {
        path: 'tax',
        component: TaxManagementComponent,
        canActivate: [permissionGuard],
        data: { permission: 'payroll.read' }
      },
      {
        path: 'office-settings',
        component: OfficeSettingsComponent,
        canActivate: [permissionGuard],
        data: { permission: 'office_settings.read' }
      },
      { path: '', pathMatch: 'full', redirectTo: 'attendance' }
    ]
  },
  { path: '**', component: NotFoundComponent }
];
