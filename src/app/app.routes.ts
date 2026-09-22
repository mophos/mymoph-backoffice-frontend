import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router, Routes, type CanActivateFn } from '@angular/router';
import { map } from 'rxjs/operators';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { AuthService } from './core/auth/auth.service';
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
import { MymophUsersManagementComponent } from './features/mymoph-users/mymoph-users-management.component';
import { FinanceUserAdminComponent } from './features/user-admin/finance-user-admin.component';

@Component({ standalone: true, changeDetection: ChangeDetectionStrategy.Eager,
 template: '' })
class EmptyComponent {}

const defaultRouteGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  return authService.ensureSession().pipe(
    map(() => router.createUrlTree([authService.getDefaultRoute()]))
  );
};

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
        path: 'finance-user-admin',
        component: FinanceUserAdminComponent,
        canActivate: [permissionGuard],
        data: { permission: 'finance_admin.manage' }
      },
      // URL เดิมยังใช้ได้ ส่งต่อไปหน้าใหม่ เพื่อไม่ให้ bookmark ของผู้ใช้เสีย
      { path: 'finance-admin', redirectTo: 'finance-user-admin', pathMatch: 'full' },
      {
        path: 'mymoph-users',
        component: MymophUsersManagementComponent,
        canActivate: [permissionGuard],
        data: { permission: 'mymoph_user.read' }
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
      {
        path: '',
        pathMatch: 'full',
        canActivate: [defaultRouteGuard],
        component: EmptyComponent
      }
    ]
  },
  { path: '**', component: NotFoundComponent }
];
