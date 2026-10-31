import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
  HttpStatusCode,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LogoutReason } from './auth.models';
import { AuthService } from './auth.service';

const LOGIN_ENDPOINT = '/auth/login';

/**
 * Adds the Bearer token to API requests, and signs the user out
 * if the API reports the token has expired.
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  const auth = inject(AuthService);
  const token = auth.token();
  const isApiCall = req.url.startsWith(environment.apiUrl);
  const isLogin = req.url.endsWith(LOGIN_ENDPOINT);

  const request =
    token && isApiCall
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(request).pipe(
    catchError((err: unknown) => {
      const isExpired =
        err instanceof HttpErrorResponse &&
        err.status === HttpStatusCode.Unauthorized;
      if (isExpired && token && !isLogin) {
        auth.logout(LogoutReason.EXPIRED);
      }
      return throwError(() => err);
    }),
  );
};
