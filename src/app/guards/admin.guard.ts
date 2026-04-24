import { inject, Injector } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { IUserService, USER_SERVICE } from '../services/user-service.interface';

/** Allows route only when GET /api/users/me reports SUPERUSER. */
export const adminGuard: CanActivateFn = () => {
  const userService = inject(Injector).get(USER_SERVICE) as IUserService;
  const router = inject(Router);
  return userService.getUserProfile().pipe(
    map(profile => {
      if (profile.permissions === 'SUPERUSER') return true;
      return router.createUrlTree(['/dashboard']);
    }),
    catchError(() => of(router.createUrlTree(['/'])))
  );
};
