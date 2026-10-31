import { GeminiError, GeminiFailure } from './gemini.client.js';
import { InvalidScreeningResponseError } from './screening-result.js';

/**
 * Processing failure handling (WBS 4.3.2.2): turns what went wrong into a
 * sentence the recruiter can act on. It is saved with the failed screening
 * and sent back with the 422 response.
 */

/** Thrown when no text could be read from the resume file. */
export class MissingResumeTextError extends Error {}

export const FAILURE_REASONS = {
  [GeminiFailure.BUSY]:
    'The AI service is busy right now. Try again in a few minutes.',
  [GeminiFailure.DAILY_LIMIT]:
    'The daily AI screening limit has been reached. Try again tomorrow.',
  [GeminiFailure.NOT_CONFIGURED]:
    'AI screening is not set up on the server. Contact the administrator.',
  [GeminiFailure.NO_ANSWER]:
    'The AI service did not answer for this resume. Try again.',
  [GeminiFailure.REJECTED]:
    'The AI service refused the request. Contact the administrator.',
  invalidAnswer: 'The AI service gave an unusable answer. Try again.',
  missingText:
    'No readable text was found in the resume. It may be a ' +
    'scanned image; ask the applicant for a text-based PDF.',
} as const;

/**
 * The reason to show for an expected screening failure, or null for any
 * other error (a bug or a database problem), which should not be saved as
 * a failed screening.
 */
export function failureReason(err: unknown): string | null {
  if (err instanceof GeminiError) return FAILURE_REASONS[err.failure];
  if (err instanceof InvalidScreeningResponseError) {
    return FAILURE_REASONS.invalidAnswer;
  }
  if (err instanceof MissingResumeTextError) {
    return FAILURE_REASONS.missingText;
  }
  return null;
}
