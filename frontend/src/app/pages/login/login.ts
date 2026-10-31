import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, from, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { AppPath } from '../../core/app-paths';
import { LogoutReason } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';

type LoginField = 'email' | 'password';

type PipelineStage = {
  name: string;
  count: number;
};

const SIGN_IN_FAILED_MESSAGE = 'Sign-in failed. Try again.';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Bound from the URL, e.g. /login?reason=expired&returnUrl=/team */
  readonly reason = input<string>();
  readonly returnUrl = input<string>();

  protected readonly LogoutReason = LogoutReason;

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isPasswordVisible = signal(false);

  /** Example pipeline shown on the brand panel (illustrative, not live). */
  readonly stages: PipelineStage[] = [
    { name: 'Applied', count: 42 },
    { name: 'Screening', count: 18 },
    { name: 'Interview', count: 7 },
    { name: 'Offer', count: 2 },
  ];

  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', { validators: [Validators.required, Validators.email] }],
    password: ['', { validators: [Validators.required] }],
  });

  shouldShowError(field: LoginField): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.auth
      .login(this.form.getRawValue())
      .pipe(
        switchMap(() =>
          from(
            this.router.navigateByUrl(this.returnUrl() || AppPath.DASHBOARD),
          ),
        ),
        finalize(() => this.isSubmitting.set(false)),
      )
      .subscribe({
        error: (err: unknown) =>
          this.errorMessage.set(apiErrorMessage(err, SIGN_IN_FAILED_MESSAGE)),
      });
  }
}
