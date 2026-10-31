import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { map, Observable } from 'rxjs';
import { ACCESS_DENIED_FLAG, AppPath } from '../app-paths';
import { STAFF_ROLES, UserRole } from './auth.models';
import { AuthService } from './auth.service';

/** Lets signed-in users through; sends everyone else to the login page. */
export const authGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
): Observable<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.restoreSession().pipe(
    map(
      (isSignedIn: boolean) =>
        isSignedIn ||
        router.createUrlTree([AppPath.LOGIN], {
          queryParams: { returnUrl: state.url },
        }),
    ),
  );
};

/**
 * Keeps signed-in users away from the login and sign-up pages: applicants
 * go to the careers site, staff to the dashboard.
 */
export const guestGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.restoreSession().pipe(
    map((isSignedIn: boolean) => {
      if (!isSignedIn) return true;
      const home = auth.hasRole(UserRole.APPLICANT)
        ? AppPath.CAREERS
        : AppPath.DASHBOARD;
      return router.createUrlTree([home]);
    }),
  );
};

/** Keeps applicants out of the staff area. Use after authGuard. */
export const staffGuard: CanActivateFn = (): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.hasRole(...STAFF_ROLES)
    ? true
    : router.createUrlTree([AppPath.CAREERS]);
};

/**
 * Restricts a route to the given roles. Use after authGuard:
 *   canActivate: [authGuard, roleGuard(UserRole.MANAGER)]
 */
export function roleGuard(...roles: UserRole[]): CanActivateFn {
  return (): boolean | UrlTree => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return auth.hasRole(...roles)
      ? true
      : router.createUrlTree([AppPath.DASHBOARD], {
          queryParams: { denied: ACCESS_DENIED_FLAG },
        });
  };
}
