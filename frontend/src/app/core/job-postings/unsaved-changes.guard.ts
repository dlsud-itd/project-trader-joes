import { CanDeactivateFn } from '@angular/router';

export type HasUnsavedChanges = {
  hasUnsavedChanges(): boolean;
};

const LEAVE_MESSAGE =
  'You have unsaved changes. Leave this page and discard them?';

/** Asks before leaving a form with edits that haven't been saved. */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (
  component: HasUnsavedChanges,
) => !component.hasUnsavedChanges() || confirm(LEAVE_MESSAGE);
