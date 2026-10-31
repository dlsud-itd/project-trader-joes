import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { apiErrorMessage } from '../../core/api/api-error';
import { ROLE_LABELS, STAFF_ROLE_LABELS, StaffRole, User } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';

/**
 * Manager-only page for staff accounts:
 * lists every account (GET /api/users) and creates new ones (POST /api/auth/register).
 */
@Component({
  selector: 'app-team',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './team.html',
  styleUrl: './team.scss',
})
export class Team implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);

  /** Only managers and recruiters can be created here; applicants self-register on the careers site. */
  protected readonly roles = Object.entries(STAFF_ROLE_LABELS) as [StaffRole, string][];
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly created = signal<User[]>([]);

  protected readonly users = signal<User[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    first_name: ['', [Validators.required, Validators.maxLength(100)]],
    last_name: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    password: [
      '',
      [Validators.required, Validators.minLength(8), Validators.pattern(/(?=.*[A-Za-z])(?=.*\d)/)],
    ],
    role: ['recruiter' as StaffRole, Validators.required],
  });

  async ngOnInit(): Promise<void> {
    try {
      const list = await firstValueFrom(this.http.get<User[]>(`${environment.apiUrl}/users`));
      this.users.set(list);
    } catch (err) {
      this.loadError.set(apiErrorMessage(err, 'Could not load accounts.'));
    } finally {
      this.loading.set(false);
    }
  }

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
      this.users.update((list) =>
        [...list, user].sort((a, b) => a.last_name.localeCompare(b.last_name)),
      );
      this.form.reset({ role: this.form.controls.role.value });
    } catch (err) {
      this.error.set(apiErrorMessage(err, 'Could not create the account.'));
    } finally {
      this.saving.set(false);
    }
  }
}


