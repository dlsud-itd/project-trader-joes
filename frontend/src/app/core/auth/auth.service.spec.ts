import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { User } from './auth.models';
import { AuthService } from './auth.service';

const LOGIN_URL = `${environment.apiUrl}/auth/login`;
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
  role: 'manager',
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
        provideRouter([{ path: 'login', children: [] }]),
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  async function signIn(): Promise<void> {
    const signingIn = auth.login({
      email: manager.email,
      password: VALID_PASSWORD,
    });
    http.expectOne(LOGIN_URL).flush({ token: FAKE_TOKEN, user: manager });
    await signingIn;
  }

  it('saves the token after login', async () => {
    await signIn();

    expect(auth.token()).toBe(FAKE_TOKEN);
  });

  it('keeps the token in localStorage after login', async () => {
    await signIn();

    expect(localStorage.getItem(TOKEN_KEY)).toBe(FAKE_TOKEN);
  });

  it('clears the token on logout', async () => {
    await signIn();

    auth.logout();

    expect(auth.token()).toBeFalsy();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('does not save a token when login fails', async () => {
    const signingIn = auth.login({
      email: manager.email,
      password: WRONG_PASSWORD,
    });
    http.expectOne(LOGIN_URL).flush(LOGIN_ERROR, UNAUTHORIZED);
    await signingIn.catch(() => undefined);

    expect(auth.token()).toBeFalsy();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});