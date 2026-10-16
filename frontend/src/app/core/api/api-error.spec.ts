import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from './api-error';

describe('apiErrorMessage', () => {
  it('uses the error message from the API', () => {
    const err = new HttpErrorResponse({ status: 401, error: { error: 'Invalid email or password' } });
    expect(apiErrorMessage(err)).toBe('Invalid email or password');
  });

  it('joins validation details', () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: { error: 'Some fields are invalid.', details: ['Enter a valid email address.', 'Enter a last name.'] },
    });
    expect(apiErrorMessage(err)).toBe('Enter a valid email address. Enter a last name.');
  });

  it('explains when the server cannot be reached', () => {
    expect(apiErrorMessage(new HttpErrorResponse({ status: 0 }))).toContain('Can’t reach the server');
  });

  it('falls back for non-HTTP errors', () => {
    expect(apiErrorMessage(new Error('x'), 'Fallback')).toBe('Fallback');
  });
});
