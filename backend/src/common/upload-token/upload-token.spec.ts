import { signUploadToken, verifyUploadToken } from './upload-token.js';

const SECRET = 'test-secret';

describe('upload tokens', () => {
  it('is a 64-character hex string', () => {
    expect(signUploadToken(101, SECRET)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('accepts the token issued for the same application', () => {
    const token = signUploadToken(101, SECRET);
    expect(verifyUploadToken(101, token, SECRET)).toBe(true);
  });

  it('rejects a token issued for a different application', () => {
    const token = signUploadToken(101, SECRET);
    expect(verifyUploadToken(102, token, SECRET)).toBe(false);
  });

  it('rejects a token signed with a different secret', () => {
    const token = signUploadToken(101, 'another-secret');
    expect(verifyUploadToken(101, token, SECRET)).toBe(false);
  });

  it('rejects tokens of the wrong length without throwing', () => {
    expect(verifyUploadToken(101, 'abc', SECRET)).toBe(false);
    expect(verifyUploadToken(101, '', SECRET)).toBe(false);
  });
});
