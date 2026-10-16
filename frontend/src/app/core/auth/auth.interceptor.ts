import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

/**
 * Adds the Bearer token to API requests, and signs the user out
 * if the API reports the token has expired.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const isApiCall = req.url.startsWith(environment.apiUrl);
  const isLogin = req.url.endsWith('/auth/login');

  const request =
    token && isApiCall ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && token && !isLogin) {
        auth.logout('expired');
      }
      return throwError(() => err);
    }),
  );
};
