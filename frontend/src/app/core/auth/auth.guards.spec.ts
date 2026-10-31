import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { firstValueFrom, isObservable, Observable, of } from 'rxjs';
import { authGuard, guestGuard, roleGuard, staffGuard } from './auth.guards';
import { UserRole } from './auth.models';
import { AuthService } from './auth.service';

const TEAM_URL = '/team';
const DENIED_URL = '/dashboard?denied=1';
const LOGIN_URL = '/login?returnUrl=%2Fteam';

const route = {} as ActivatedRouteSnapshot;
const state = { url: TEAM_URL } as RouterStateSnapshot;

/** Sets up TestBed with a fake AuthService for a role (or nobody). */
function signedInAs(role: UserRole | null): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          hasRole: (...roles: UserRole[]): boolean =>
            role !== null && roles.includes(role),
          restoreSession: (): Observable<boolean> => of(role !== null),
        },
      },
    ],
  });
}

/** Runs a guard and waits for its answer, whatever form it takes. */
async function runGuard(guard: CanActivateFn): Promise<unknown> {
  const result = TestBed.runInInjectionContext(() => guard(route, state));
  return isObservable(result) ? firstValueFrom(result) : result;
}

function urlOf(result: unknown): string {
  return TestBed.inject(Router).serializeUrl(result as UrlTree);
}

describe('roleGuard', () => {
  it('lets a manager open /team', async () => {
    signedInAs(UserRole.MANAGER);

    const result = await runGuard(roleGuard(UserRole.MANAGER));

    expect(result).toBe(true);
  });

  it('sends a recruiter to /dashboard?denied=1', async () => {
    signedInAs(UserRole.RECRUITER);

    const result = await runGuard(roleGuard(UserRole.MANAGER));

    expect(result).toBeInstanceOf(UrlTree);
    expect(urlOf(result)).toBe(DENIED_URL);
  });
});

describe('authGuard', () => {
  it('sends a signed-out visitor to login', async () => {
    signedInAs(null);

    const result = await runGuard(authGuard);

    expect(urlOf(result)).toBe(LOGIN_URL);
  });
});

describe('staffGuard', () => {
  it('lets a recruiter into the staff area', async () => {
    signedInAs(UserRole.RECRUITER);

    const result = await runGuard(staffGuard);

    expect(result).toBe(true);
  });

  it('sends an applicant to the careers site instead', async () => {
    signedInAs(UserRole.APPLICANT);

    const result = await runGuard(staffGuard);

    expect(result).toBeInstanceOf(UrlTree);
    expect(urlOf(result)).toBe('/careers');
  });
});

describe('guestGuard', () => {
  it('lets a signed-out visitor through', async () => {
    signedInAs(null);

    const result = await runGuard(guestGuard);

    expect(result).toBe(true);
  });

  it('sends a signed-in applicant to /careers, not /dashboard', async () => {
    signedInAs(UserRole.APPLICANT);

    const result = await runGuard(guestGuard);

    expect(urlOf(result)).toBe('/careers');
  });

  it('sends a signed-in manager to /dashboard', async () => {
    signedInAs(UserRole.MANAGER);

    const result = await runGuard(guestGuard);

    expect(urlOf(result)).toBe('/dashboard');
  });
});
