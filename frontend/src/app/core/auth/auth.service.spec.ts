import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { User } from './auth.models';
import { AuthService } from './auth.service';

const TOKEN_KEY = 'talentflow.token';

const manager: User = {
  id: 1,
  email: 'manager@talentflow.dev',
  first_name: 'Maria',
  last_name: 'Santos',
  role: 'manager',
};

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  /** Fails the test if any request was made that the test didn't answer. */
  afterEach(() => http.verify());

  /** Signs in as the manager, answering the login request with a fake token. */
  async function signIn(token = 'abc'): Promise<void> {
    const done = auth.login({ email: manager.email, password: 'x' });
    const req = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush({ token, user: manager });
    await done;
  }

  it('saves the token after login', async () => {
    await signIn('abc');

    expect(auth.token()).toBe('abc');
    expect(localStorage.getItem(TOKEN_KEY)).toBe('abc');
  });

  it('stores the signed-in user after login', async () => {
    await signIn();

    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.fullName()).toBe('Maria Santos');
    expect(auth.hasRole('manager')).toBe(true);
    expect(auth.hasRole('recruiter')).toBe(false);
  });

  it('clears the token on logout', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await signIn('abc');

    auth.logout();

    expect(auth.token()).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login'], {});
  });

  it('tells the login page when the session expired', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await signIn();

    auth.logout('expired');

    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'expired' } });
  });
});

