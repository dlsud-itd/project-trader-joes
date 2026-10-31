import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';

/**
 * `COMPLETED` has a fit score; `FAILED` can be retried.
 * Values match what the API sends.
 */
export enum ScreeningStatus {
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/** How well the resume shows one posting requirement. */
export enum RequirementMatchLevel {
  MET = 'met',
  PARTIAL = 'partial',
  MISSING = 'missing',
}

export type RequirementMatch = {
  requirement: string;
  match: RequirementMatchLevel;
  /** The resume line that shows it, or what was not found. */
  evidence: string;
};

/** A saved screening (GET /api/ai-screenings/:applicationId). */
export type AiScreening = {
  id: number;
  application_id: number;
  /** 0–100; null while the screening has failed. */
  fit_score: number | null;
  explanation: string | null;
  requirement_matches: RequirementMatch[] | null;
  status: ScreeningStatus;
  /** Why the last screening failed; null once it passes. */
  failure_reason: string | null;
  retry_count: number;
  screened_at: string;
};

/** Body for POST /api/ai-screenings. */
export type AiScreeningInput = {
  application_id: number;
  retry?: boolean;
};

export type AiScreeningResponse = {
  message: string;
  screening: AiScreening;
};

/** The 422 body when a screening could not be completed. */
export type AiScreeningFailure = {
  error: string;
  status: ScreeningStatus.FAILED;
  retry_count: number;
  failure_reason: string | null;
};

/**
 * The failed screening inside an API error, so the screen can show why it
 * failed and offer a retry. Null for any other error.
 */
export function screeningFailure(err: unknown): AiScreeningFailure | null {
  const isFailedScreening =
    err instanceof HttpErrorResponse &&
    err.status === HttpStatusCode.UnprocessableEntity;
  return isFailedScreening ? (err.error as AiScreeningFailure) : null;
}
