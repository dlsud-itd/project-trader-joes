import { HttpErrorResponse } from '@angular/common/http';

/**
 * Turns an API error into a sentence the user can act on.
 * The backend always responds with `{ error: string, details?: string[] }`.
 */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (!(err instanceof HttpErrorResponse)) return fallback;
  if (err.status === 0) {
    return 'Can’t reach the server. Check your connection, or wait a moment if the server is waking up.';
  }
  const body = err.error as { error?: string; details?: string[] } | null;
  if (body?.details?.length) return body.details.join(' ');
  return body?.error ?? fallback;
}
