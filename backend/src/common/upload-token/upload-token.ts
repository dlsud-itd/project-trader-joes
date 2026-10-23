import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Applicants don't sign in, so submitting an application returns a token that
 * proves the resume upload comes from the same person. It is an HMAC of the
 * application id, so it can't be guessed for other applications and can't be
 * used as a sign-in token.
 */
export function signUploadToken(applicationId: number, secret: string): string {
  return createHmac('sha256', secret)
    .update(`resume-upload:${applicationId}`)
    .digest('hex');
}

export function verifyUploadToken(
  applicationId: number,
  token: string,
  secret: string,
): boolean {
  const expected = Buffer.from(signUploadToken(applicationId, secret));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
