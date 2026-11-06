import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, from, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { AppPath } from '../../core/app-paths';
import { AuthService } from '../../core/auth/auth.service';
import { notBlank } from '../../shared/validators';

const NAME_MAX_LENGTH = 100;

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
    first_name: [
      '',
      {
        validators: [
          Validators.required,
          notBlank,
          Validators.maxLength(NAME_MAX_LENGTH),
        ],
      },
    ],
    last_name: [
      '',
      {
        validators: [
          Validators.required,
          notBlank,
          Validators.maxLength(NAME_MAX_LENGTH),
        ],
      },
    ],
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
    const { first_name, last_name, email, password } = this.form.getRawValue();
    this.auth
      .registerApplicant({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email,
        password,
      })
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
