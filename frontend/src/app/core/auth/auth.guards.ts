import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from './auth.models';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (await auth.restoreSession()) return true;
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!(await auth.restoreSession())) return true;
  return router.createUrlTree([auth.hasRole('applicant') ? '/careers' : '/dashboard']);
};

export const staffGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.hasRole('manager', 'recruiter') ? true : router.createUrlTree(['/careers']);
};

export function roleGuard(...roles: UserRole[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return auth.hasRole(...roles)
      ? true
      : router.createUrlTree(['/dashboard'], { queryParams: { denied: 1 } });
  };
}
