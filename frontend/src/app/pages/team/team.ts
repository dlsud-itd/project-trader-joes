import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { apiErrorMessage } from '../../core/api/api-error';
import { ROLE_LABELS, User, UserRole } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';

/** Manager-only page for creating staff accounts (POST /api/auth/register). */
@Component({
  selector: 'app-team',
  imports: [ReactiveFormsModule],
  templateUrl: './team.html',
  styleUrl: './team.scss',
})
export class Team {
  private readonly auth = inject(AuthService);

  protected readonly roles = Object.entries(ROLE_LABELS) as [UserRole, string][];
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly created = signal<User[]>([]);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    first_name: ['', [Validators.required, Validators.maxLength(100)]],
    last_name: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    password: [
      '',
      [Validators.required, Validators.minLength(8), Validators.pattern(/(?=.*[A-Za-z])(?=.*\d)/)],
    ],
    role: ['recruiter' as UserRole, Validators.required],
  });

  showError(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const { user } = await this.auth.register(this.form.getRawValue());
      this.created.update((list) => [user, ...list]);
      this.form.reset({ role: this.form.controls.role.value });
    } catch (err) {
      this.error.set(apiErrorMessage(err, 'Could not create the account.'));
    } finally {
      this.saving.set(false);
    }
  }
}
