import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthSessionService } from '../services/auth-session.service';

const AUTH_TOKEN_KEY = 'auth_token';

/**
 * Endpoints that legitimately answer 401/403 for bad/expired credentials while
 * the user is *not* logged in (the login screen handles those errors itself), so
 * they must never trigger the session-expiry redirect.
 */
const AUTH_ENDPOINTS = ['/api/users/login', '/api/users/forgot-password'];

/**
 * When an authenticated request comes back 401/403, the JWT has almost certainly
 * expired. Grondona keeps returning 403 but the app used to swallow it (services
 * fall back to `of(null)`), leaving the user stuck on a half-broken screen. Here
 * we clear the stale token and send them back to the login screen to get a fresh
 * one.
 */
export const authExpiryInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authSession = inject(AuthSessionService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
        const isAuthEndpoint = AUTH_ENDPOINTS.some(path => req.url.includes(path));
        const hadToken = !!localStorage.getItem(AUTH_TOKEN_KEY);

        // Only react when a logged-in session went stale, and avoid redirect loops.
        if (!isAuthEndpoint && hadToken) {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          authSession.flagExpired();
          if (router.url !== '/') {
            router.navigate(['/']);
          }
        }
      }
      return throwError(() => error);
    })
  );
};
