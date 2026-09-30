import { inject } from '@angular/core';
import { CanActivateFn, ActivatedRouteSnapshot, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import type { PermissionCode } from '../models/auth.models';

/**
 * ตรวจสิทธิ์เข้าหน้า ทั้ง permission และบทบาทที่บางหน้าบังคับเพิ่ม
 *
 * ADMIN-06: เดิมตรวจ permission อย่างเดียว ทำให้หน้าที่ backend บังคับบทบาท
 * เพิ่มอีกชั้น (ผู้ใช้และสิทธิ์: การเงิน ต้องมี super_admin_affairs)
 * เข้าได้แต่ทุกคำขอตอบ FORBIDDEN ผู้ใช้จึงเห็นหน้าเปล่าที่ใช้งานไม่ได้
 *
 * ประกาศใน route ด้วย data: { permission: '...', roles: ['...'] }
 */
export const permissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const requiredPermission = route.data['permission'] as PermissionCode | undefined;
  const requiredRoles = (route.data['roles'] as string[] | undefined) ?? [];

  if (!requiredPermission && !requiredRoles.length) return true;

  return authService.ensureSession().pipe(
    map((isAuthenticated) => {
      if (!isAuthenticated) {
        return router.createUrlTree(['/login']);
      }

      if (requiredPermission && !authService.hasPermission(requiredPermission)) {
        return router.createUrlTree(['/unauthorized']);
      }

      const roles = authService.currentUser?.roles ?? [];
      const hasRoles = requiredRoles.every((role) => roles.includes(role));
      if (!hasRoles) {
        return router.createUrlTree(['/unauthorized']);
      }

      return true;
    })
  );
};
