import { inject } from '@angular/core';
import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn
} from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { API_BASE_URL } from '../services/api.config';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const authService = inject(AuthService);
  const attachAuth = (request: HttpRequest<unknown>) => {
    const token = authService.bearerToken;
    return token
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` }, withCredentials: true })
      : request.clone({ withCredentials: true });
  };

  return next(attachAuth(req)).pipe(
    catchError((error: HttpErrorResponse) => {
      const isUnauthorized = error.status === 401;
      const isRefreshRequest = req.url.includes(`${API_BASE_URL}/auth/refresh`);

      if (!isUnauthorized) {
        return throwError(() => error);
      }

      if (isRefreshRequest) {
        authService.clearSession();
        return throwError(() => error);
      }

      return authService.refresh().pipe(
        switchMap((ok) => {
          if (!ok) {
            authService.clearSession();
            return throwError(() => error);
          }

          return next(attachAuth(req));
        }),
        catchError((refreshError) => {
          authService.clearSession();
          return throwError(() => refreshError);
        })
      );
    })
  );
};
