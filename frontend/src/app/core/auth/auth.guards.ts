import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from './auth.models';
import { AuthService } from './auth.service';

/** Lets signed-in users through; sends everyone else to the login page. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (await auth.restoreSession()) return true;
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Keeps signed-in users away from the login page. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return (await auth.restoreSession()) ? router.createUrlTree(['/dashboard']) : true;
};

/**
 * Restricts a route to the given roles. Use after authGuard:
 *   canActivate: [authGuard, roleGuard('manager')]
 */
export function roleGuard(...roles: UserRole[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return auth.hasRole(...roles)
      ? true
      : router.createUrlTree(['/dashboard'], { queryParams: { denied: 1 } });
  };
}
