import { AbstractControl } from '@angular/forms';

/**
 * Fails when a field has only spaces, which `Validators.required` lets
 * through. An empty field is left to `Validators.required`.
 */
export function notBlank(control: AbstractControl): { blank: string } | null {
  const value: unknown = control.value;
  const isOnlySpaces =
    typeof value === 'string' && value !== '' && value.trim() === '';
  return isOnlySpaces ? { blank: 'This cannot be only spaces.' } : null;
}
