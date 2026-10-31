import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { User, UserRole } from './auth.models';
import { AuthService } from './auth.service';

const LOGIN_URL = `${environment.apiUrl}/auth/login`;
const REGISTER_APPLICANT_URL = `${environment.apiUrl}/auth/register-applicant`;
const TOKEN_KEY = 'talentflow.token';
const FAKE_TOKEN = 'abc';
const VALID_PASSWORD = 'Manager123!';
const WRONG_PASSWORD = 'wrong-password';
const LOGIN_ERROR = { error: 'Invalid email or password' };
const UNAUTHORIZED = { status: 401, statusText: 'Unauthorized' };

const manager: User = {
  id: 1,
  email: 'manager@talentflow.dev',
  first_name: 'Maria',
  last_name: 'Santos',
  role: UserRole.MANAGER,
  created_at: '2026-10-16T00:00:00Z',
};

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'login', children: [] },
          { path: 'careers', children: [] },
        ]),
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  function signIn(user: User = manager): void {
    auth.login({ email: user.email, password: VALID_PASSWORD }).subscribe();
    http.expectOne(LOGIN_URL).flush({ token: FAKE_TOKEN, user });
  }

  it('saves the token after login', () => {
    signIn();

    expect(auth.token()).toBe(FAKE_TOKEN);
  });

  it('keeps the token in localStorage after login', () => {
    signIn();

    expect(localStorage.getItem(TOKEN_KEY)).toBe(FAKE_TOKEN);
  });

  it('clears the token on logout', () => {
    signIn();

    auth.logout();

    expect(auth.token()).toBeFalsy();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('does not save a token when login fails', () => {
    auth
      .login({ email: manager.email, password: WRONG_PASSWORD })
      .subscribe({ error: () => undefined });
    http.expectOne(LOGIN_URL).flush(LOGIN_ERROR, UNAUTHORIZED);

    expect(auth.token()).toBeFalsy();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('sends a signed-in applicant to /careers on logout', () => {
    signIn({ ...manager, role: UserRole.APPLICANT });

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    auth.logout();

    expect(navigate).toHaveBeenCalledWith(['/careers'], {});
  });

  it('registers an applicant without a role in the request body', () => {
    const body = {
      email: 'ana@example.com',
      password: 'Password123',
      first_name: 'Ana',
      last_name: 'Cruz',
    };
    auth.registerApplicant(body).subscribe();

    const req = http.expectOne(REGISTER_APPLICANT_URL);
    expect(req.request.body).toEqual(body);
    req.flush({
      message: 'Account created successfully.',
      user: { ...manager, role: UserRole.APPLICANT },
    });
  });
});
