import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, from, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { AppPath } from '../../core/app-paths';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-applicant-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './applicant-register.html',
  styleUrl: './applicant-register.scss',
})
export class ApplicantRegister {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly showPassword = signal(false);

  readonly form = inject(FormBuilder).nonNullable.group({
    first_name: ['', [Validators.required, Validators.maxLength(100)]],
    last_name: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/(?=.*[A-Za-z])(?=.*\d)/),
      ],
    ],
  });

  showError(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }

  /** Creates the account, signs in with it, then opens the careers site. */
  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth
      .registerApplicant(this.form.getRawValue())
      .pipe(
        switchMap(() => this.auth.login({ email, password })),
        switchMap(() => from(this.router.navigateByUrl(AppPath.CAREERS))),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe({
        error: (err: unknown) =>
          this.error.set(
            apiErrorMessage(err, 'Could not create your account. Try again.'),
          ),
      });
  }
}
