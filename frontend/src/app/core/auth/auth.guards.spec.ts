import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { authGuard, roleGuard } from './auth.guards';
import { UserRole } from './auth.models';
import { AuthService } from './auth.service';

const route = {} as ActivatedRouteSnapshot;
const state = (url: string) => ({ url }) as RouterStateSnapshot;

/** Sets up TestBed with a fake AuthService for a signed-in user (or nobody). */
function signedInAs(role: UserRole | null): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          hasRole: (...roles: UserRole[]) => role !== null && roles.includes(role),
          restoreSession: async () => role !== null,
        },
      },
    ],
  });
}

const urlOf = (result: unknown) => TestBed.inject(Router).serializeUrl(result as UrlTree);

describe('roleGuard', () => {
  it('lets a manager open /team', () => {
    signedInAs('manager');

    const result = TestBed.runInInjectionContext(() => roleGuard('manager')(route, state('/team')));

    expect(result).toBe(true);
  });

  it('sends a recruiter back to the dashboard', () => {
    signedInAs('recruiter');

    const result = TestBed.runInInjectionContext(() => roleGuard('manager')(route, state('/team')));

    expect(result).toBeInstanceOf(UrlTree);
    expect(urlOf(result)).toBe('/dashboard?denied=1');
  });
});

describe('authGuard', () => {
  it('sends a signed-out visitor to login and remembers the page', async () => {
    signedInAs(null);

    const result = await TestBed.runInInjectionContext(() => authGuard(route, state('/team')));

    expect(urlOf(result)).toBe('/login?returnUrl=%2Fteam');
  });
});