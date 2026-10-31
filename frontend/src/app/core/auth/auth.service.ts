import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppPath } from '../app-paths';
import {
  LoginRequest,
  LoginResponse,
  LogoutReason,
  RegisterApplicantRequest,
  RegisterRequest,
  RegisterResponse,
  User,
  UserRole,
} from './auth.models';

const TOKEN_KEY = 'talentflow.token';

/**
 * Holds the signed-in user and token.
 * The token is kept in localStorage so a page refresh keeps the session.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly api = `${environment.apiUrl}/auth`;

  private readonly _user = signal<User | null>(null);
  private readonly _token = signal<string | null>(readToken());

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly fullName = computed(() => {
    const user = this._user();
    return user ? `${user.first_name} ${user.last_name}` : '';
  });

  token(): string | null {
    return this._token();
  }

  hasRole(...roles: UserRole[]): boolean {
    const user = this._user();
    return !!user && roles.includes(user.role);
  }

  /** Signs in and keeps the token. Emits the signed-in user. */
  login(credentials: LoginRequest): Observable<User> {
    return this.http.post<LoginResponse>(`${this.api}/login`, credentials).pipe(
      tap((res: LoginResponse) => {
        this.setToken(res.token);
        this._user.set(res.user);
      }),
      map((res: LoginResponse) => res.user),
    );
  }

  /** Creates a staff account. Managers only. */
  register(body: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.api}/register`, body);
  }

  /** An applicant creates their own account from the careers site. */
  registerApplicant(
    body: RegisterApplicantRequest,
  ): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(
      `${this.api}/register-applicant`,
      body,
    );
  }

  /**
   * Restores the session after a page refresh by asking the API who the
   * token belongs to. Emits false if there is no token or it is no longer
   * valid.
   */
  restoreSession(): Observable<boolean> {
    if (this._user()) return of(true);
    if (!this._token()) return of(false);
    return this.http.get<User>(`${this.api}/me`).pipe(
      tap((user: User) => this._user.set(user)),
      map(() => true),
      catchError(() => {
        this.clear();
        return of(false);
      }),
    );
  }

  /**
   * Tokens are stateless, so signing out only clears them on this device.
   * Applicants go back to the careers site; staff go to the staff login.
   */
  logout(reason?: LogoutReason): void {
    const destination = this.hasRole(UserRole.APPLICANT)
      ? AppPath.CAREERS
      : AppPath.LOGIN;
    this.clear();
    void this.router.navigate(
      [destination],
      reason ? { queryParams: { reason } } : {},
    );
  }

  private setToken(token: string): void {
    this._token.set(token);
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Storage can be blocked (private mode); the session then lasts
      // until refresh.
    }
  }

  private clear(): void {
    this._token.set(null);
    this._user.set(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Storage can be blocked; nothing to remove then.
    }
  }
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
