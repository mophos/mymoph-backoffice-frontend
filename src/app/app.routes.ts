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
import { AttendanceComponent } from './features/attendance/attendance.component';
import { PersonnelComponent } from './features/personnel/personnel.component';
import { PayrollPlaceholderComponent } from './features/payroll/payroll-placeholder.component';
import { TaxManagementComponent } from './features/tax/tax-management.component';
import { OfficeSettingsV2Component } from './features/office-settings-v2/office-settings.component';
import { MymophUsersComponent } from './features/mymoph-users/mymoph-users.component';
import { FinanceUserAdminComponent } from './features/user-admin/finance-user-admin.component';
import { UserAdminComponent } from './features/user-admin/user-admin.component';

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
        component: AttendanceComponent,
        canActivate: [permissionGuard],
        data: { permission: 'attendance.read' }
      },
      {
        path: 'user-admin',
        component: UserAdminComponent,
        canActivate: [permissionGuard],
        data: { permission: 'user_admin.manage' }
      },
      // URL เดิมยังใช้ได้ ส่งต่อไปหน้าใหม่ เพื่อไม่ให้ bookmark ของผู้ใช้เสีย
      { path: 'hr-admin', redirectTo: 'user-admin', pathMatch: 'full' },
      {
        path: 'finance-user-admin',
        component: FinanceUserAdminComponent,
        canActivate: [permissionGuard],
        // backend บังคับบทบาทนี้อีกชั้น ถ้าไม่ตรวจที่นี่จะเข้าหน้าได้แต่ใช้งานไม่ได้ (ADMIN-06)
        data: { permission: 'finance_admin.manage', roles: ['super_admin_affairs'] }
      },
      // URL เดิมยังใช้ได้ ส่งต่อไปหน้าใหม่ เพื่อไม่ให้ bookmark ของผู้ใช้เสีย
      { path: 'finance-admin', redirectTo: 'finance-user-admin', pathMatch: 'full' },
      {
        path: 'mymoph-users',
        component: MymophUsersComponent,
        canActivate: [permissionGuard],
        data: { permission: 'mymoph_user.read' }
      },
      {
        path: 'personnel',
        component: PersonnelComponent,
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
        component: OfficeSettingsV2Component,
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
