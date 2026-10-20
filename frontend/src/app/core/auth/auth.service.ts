import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  LoginRequest,
  LoginResponse,
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
    const u = this._user();
    return u ? `${u.first_name} ${u.last_name}` : '';
  });

  token(): string | null {
    return this._token();
  }

  hasRole(...roles: UserRole[]): boolean {
    const user = this._user();
    return !!user && roles.includes(user.role);
  }

  async login(credentials: LoginRequest): Promise<User> {
    const res = await firstValueFrom(this.http.post<LoginResponse>(`${this.api}/login`, credentials));
    this.setToken(res.token);
    this._user.set(res.user);
    return res.user;
  }

  register(body: RegisterRequest): Promise<RegisterResponse> {
    return firstValueFrom(this.http.post<RegisterResponse>(`${this.api}/register`, body));
  }

  /**
   * Restores the session after a page refresh by asking the API who the token belongs to.
   * Returns false if there is no token or it is no longer valid.
   */
  async restoreSession(): Promise<boolean> {
    if (this._user()) return true;
    if (!this._token()) return false;
    try {
      this._user.set(await firstValueFrom(this.http.get<User>(`${this.api}/me`)));
      return true;
    } catch {
      this.clear();
      return false;
    }
  }

  /** Tokens are stateless, so signing out only clears them on this device. */
  logout(reason?: 'expired'): void {
    this.clear();
    void this.router.navigate(['/login'], reason ? { queryParams: { reason } } : {});
  }

  private setToken(token: string): void {
    this._token.set(token);
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* Storage can be blocked (private mode); the session then lasts until refresh. */
    }
  }

  private clear(): void {
    this._token.set(null);
    this._user.set(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
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
