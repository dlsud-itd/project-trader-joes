import { FormControl } from '@angular/forms';
import { notBlank } from './not-blank';

describe('notBlank', () => {
  it('fails for a value of only spaces', () => {
    expect(notBlank(new FormControl('   '))).toEqual({
      blank: 'This cannot be only spaces.',
    });
  });

  it('passes real text and leaves empty fields to required', () => {
    expect(notBlank(new FormControl(' Ana '))).toBeNull();
    expect(notBlank(new FormControl(''))).toBeNull();
  });
});
