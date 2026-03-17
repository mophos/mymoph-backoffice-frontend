import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, finalize, map, shareReplay, tap } from 'rxjs/operators';
import { API_BASE_URL } from '../services/api.config';
import { ApiEnvelope, CurrentUser, PermissionCode } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userSubject = new BehaviorSubject<CurrentUser | null>(null);
  readonly user$ = this.userSubject.asObservable();

  private accessToken: string | null = localStorage.getItem('bo_access_token');
  private refreshInFlight$: Observable<boolean> | null = null;

  constructor(private readonly http: HttpClient, private readonly router: Router) {}

  get currentUser(): CurrentUser | null {
    return this.userSubject.value;
  }

  get bearerToken(): string | null {
    return this.accessToken;
  }

  ensureSession(): Observable<boolean> {
    if (this.userSubject.value) {
      return of(true);
    }

    return this.fetchMe().pipe(
      map((user) => !!user),
      catchError(() => of(false))
    );
  }

  fetchMe(): Observable<CurrentUser | null> {
    return this.http.get<ApiEnvelope<{ user: CurrentUser }>>(`${API_BASE_URL}/auth/me`, { withCredentials: true }).pipe(
      tap((res) => {
        this.userSubject.next(res.data.user);
      }),
      map((res) => res.data.user),
      catchError(() => {
        this.userSubject.next(null);
        return of(null);
      })
    );
  }

  loginWithMyMoph(): void {
    this.accessToken = null;
    localStorage.removeItem('bo_access_token');

    this.http
      .get<ApiEnvelope<{ authorizationUrl: string }>>(`${API_BASE_URL}/auth/login-url?returnTo=/attendance`, {
        withCredentials: true
      })
      .subscribe({
        next: (res) => {
          window.location.href = res.data.authorizationUrl;
        },
        error: () => {
          alert('ไม่สามารถเริ่มกระบวนการ login ได้');
        }
      });
  }

  handleCallback(): Observable<boolean> {
    return this.fetchMe().pipe(
      map((user) => {
        if (!user) {
          return false;
        }
        return true;
      })
    );
  }

  refresh(): Observable<boolean> {
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }

    this.refreshInFlight$ = this.http
      .post<ApiEnvelope<{ accessToken: string }>>(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        tap((res) => {
          const token = res.data.accessToken;
          this.accessToken = token;
          localStorage.setItem('bo_access_token', token);
        }),
        map(() => true),
        catchError(() => of(false)),
        finalize(() => {
          this.refreshInFlight$ = null;
        }),
        shareReplay(1)
      );

    return this.refreshInFlight$;
  }

  logout(): void {
    this.http.post(`${API_BASE_URL}/auth/logout`, {}, { withCredentials: true }).subscribe({
      next: () => this.clearSession(),
      error: () => this.clearSession()
    });
  }

  clearSession(): void {
    this.userSubject.next(null);
    this.accessToken = null;
    localStorage.removeItem('bo_access_token');
    this.router.navigate(['/login']);
  }

  hasPermission(permission: PermissionCode): boolean {
    const user = this.userSubject.value;
    if (!user) return false;
    return user.permissions.includes(permission);
  }
}
