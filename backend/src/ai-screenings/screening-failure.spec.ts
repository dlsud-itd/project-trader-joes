import { GeminiError, GeminiFailure } from './gemini.client.js';
import {
  FAILURE_REASONS,
  failureReason,
  MissingResumeTextError,
} from './screening-failure.js';
import { InvalidScreeningResponseError } from './screening-result.js';

describe('failureReason', () => {
  it.each(Object.values(GeminiFailure))(
    'explains a Gemini "%s" failure',
    (failure) => {
      expect(failureReason(new GeminiError('detail', failure))).toBe(
        FAILURE_REASONS[failure],
      );
    },
  );

  it('tells the recruiter to wait when Gemini is busy', () => {
    const busy = new GeminiError('503', GeminiFailure.BUSY);
    expect(failureReason(busy)).toMatch(/Try again in a few minutes/);
  });

  it('explains an unusable answer', () => {
    expect(failureReason(new InvalidScreeningResponseError('bad'))).toBe(
      FAILURE_REASONS.invalidAnswer,
    );
  });

  it('explains a resume without readable text', () => {
    expect(failureReason(new MissingResumeTextError('none'))).toMatch(
      /scanned image/,
    );
  });

  it('leaves other errors alone', () => {
    expect(failureReason(new Error('database is down'))).toBeNull();
    expect(failureReason('not an error')).toBeNull();
  });
});
