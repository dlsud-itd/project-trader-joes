import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, from, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { AppPath } from '../../core/app-paths';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-applicant-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './applicant-login.html',
  styleUrl: './applicant-login.scss',
})
export class ApplicantLogin {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Bound from the URL, e.g. /careers/login?returnUrl=/careers/3/apply */
  readonly returnUrl = input<string>();

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly showPassword = signal(false);

  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  showError(field: 'email' | 'password'): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.auth
      .login(this.form.getRawValue())
      .pipe(
        switchMap(() =>
          from(this.router.navigateByUrl(this.returnUrl() || AppPath.CAREERS)),
        ),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe({
        error: (err: unknown) =>
          this.error.set(apiErrorMessage(err, 'Sign-in failed. Try again.')),
      });
  }
}
