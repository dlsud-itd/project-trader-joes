import { HttpErrorResponse } from '@angular/common/http';

/** The backend's error body: `{ error: string, details?: string[] }`. */
export type ApiErrorBody = {
  error?: string;
  details?: string[];
};

/** Status the browser reports when the request never reached the server. */
const NO_RESPONSE_STATUS = 0;

const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Try again.';
const UNREACHABLE_MESSAGE =
  'Can’t reach the server. Check your connection, ' +
  'or wait a moment if the server is waking up.';

/** Turns an API error into a sentence the user can act on. */
export function apiErrorMessage(
  err: unknown,
  fallback: string = DEFAULT_ERROR_MESSAGE,
): string {
  if (!(err instanceof HttpErrorResponse)) return fallback;
  if (err.status === NO_RESPONSE_STATUS) return UNREACHABLE_MESSAGE;
  const body = err.error as ApiErrorBody | null;
  if (body?.details?.length) return body.details.join(' ');
  return body?.error ?? fallback;
}
