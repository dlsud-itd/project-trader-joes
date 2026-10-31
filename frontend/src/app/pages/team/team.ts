import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import {
  RegisterResponse,
  ROLE_LABELS,
  User,
  UserRole,
} from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { UsersService } from '../../core/users';

type RoleOption = {
  value: UserRole;
  label: string;
};

/** Limits that match the API's register validation. */
const NAME_MAX_LENGTH = 100;
const PASSWORD_MIN_LENGTH = 8;
/** At least one letter and one number. */
const PASSWORD_PATTERN = /(?=.*[A-Za-z])(?=.*\d)/;

const LOAD_FAILED_MESSAGE = 'Could not load accounts.';
const CREATE_FAILED_MESSAGE = 'Could not create the account.';

/**
 * Manager-only page for staff accounts: lists every account
 * (GET /api/users) and creates new ones (POST /api/auth/register).
 */
@Component({
  selector: 'app-team',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './team.html',
  styleUrl: './team.scss',
})
export class Team implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly usersService = inject(UsersService);

  protected readonly roles: RoleOption[] = Object.values(UserRole).map(
    (role: UserRole) => ({ value: role, label: ROLE_LABELS[role] }),
  );
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly created = signal<User[]>([]);

  protected readonly users = signal<User[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    first_name: [
      '',
      {
        validators: [
          Validators.required,
          Validators.maxLength(NAME_MAX_LENGTH),
        ],
      },
    ],
    last_name: [
      '',
      {
        validators: [
          Validators.required,
          Validators.maxLength(NAME_MAX_LENGTH),
        ],
      },
    ],
    email: ['', { validators: [Validators.required, Validators.email] }],
    password: [
      '',
      {
        validators: [
          Validators.required,
          Validators.minLength(PASSWORD_MIN_LENGTH),
          Validators.pattern(PASSWORD_PATTERN),
        ],
      },
    ],
    role: [UserRole.RECRUITER, { validators: [Validators.required] }],
  });

  ngOnInit(): void {
    this.usersService
      .list()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (list: User[]) => this.users.set(list),
        error: (err: unknown) =>
          this.loadError.set(apiErrorMessage(err, LOAD_FAILED_MESSAGE)),
      });
  }

  shouldShowError(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.auth
      .register(this.form.getRawValue())
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: ({ user }: RegisterResponse) => {
          this.created.update((list: User[]) => [user, ...list]);
          this.users.update((list: User[]) =>
            [...list, user].sort((a: User, b: User) =>
              a.last_name.localeCompare(b.last_name),
            ),
          );
          this.form.reset({ role: this.form.controls.role.value });
        },
        error: (err: unknown) =>
          this.errorMessage.set(apiErrorMessage(err, CREATE_FAILED_MESSAGE)),
      });
  }
}
