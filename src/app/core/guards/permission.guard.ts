import { inject } from '@angular/core';
import { CanActivateFn, ActivatedRouteSnapshot, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import type { PermissionCode } from '../models/auth.models';

export const permissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const requiredPermission = route.data['permission'] as PermissionCode | undefined;
  if (!requiredPermission) return true;

  return authService.ensureSession().pipe(
    map((isAuthenticated) => {
      if (!isAuthenticated) {
        return router.createUrlTree(['/login']);
      }

      if (authService.hasPermission(requiredPermission)) {
        return true;
      }

      return router.createUrlTree(['/unauthorized']);
    })
  );
};
