import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { environment } from '../../../environments/environment';
import { apiErrorMessage } from '../../core/api/api-error';
import { HealthService } from '../../core/api/health.service';
import { ROLE_LABELS, StaffRole, UserRole } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';

enum ApiStatus {
  CHECKING = 'checking',
  UP = 'up',
  DOWN = 'down',
}

type ApiState =
  | { kind: ApiStatus.CHECKING }
  | { kind: ApiStatus.UP; checkedAt: Date }
  | { kind: ApiStatus.DOWN; message: string };

/** Hours (24h clock) where the greeting changes. */
const AFTERNOON_STARTS_AT = 12;
const EVENING_STARTS_AT = 18;

/**
 * What each role can do, from the TalentFlow user stories. The dashboard is
 * staff-only.
 */
const ACCESS: Record<StaffRole, string[]> = {
  [UserRole.MANAGER]: [
    'Create, edit, and close job postings',
    'Assign recruiters to postings',
    'Manage the applicant pipeline',
    'View the recruitment dashboard',
    'Create staff accounts',
  ],
  [UserRole.RECRUITER]: [
    'View job postings',
    'View applicants and profiles (read-only)',
    'Rate applicants and add notes',
    'Search and sort applicants',
  ],
};

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private readonly health = inject(HealthService);
  protected readonly auth = inject(AuthService);

  /** Set to 1 when roleGuard redirects here. */
  readonly denied = input<string>();

  protected readonly ApiStatus = ApiStatus;
  protected readonly api = signal<ApiState>({ kind: ApiStatus.CHECKING });
  protected readonly apiUrl = environment.apiUrl;

  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    let part = 'Good evening';
    if (hour < AFTERNOON_STARTS_AT) part = 'Good morning';
    else if (hour < EVENING_STARTS_AT) part = 'Good afternoon';
    return `${part}, ${this.auth.user()?.first_name ?? ''}`;
  });

  /** The shell already keeps applicants out, so this is always staff. */
  protected readonly role = computed<StaffRole>(() =>
    this.auth.user()?.role === UserRole.MANAGER
      ? UserRole.MANAGER
      : UserRole.RECRUITER,
  );
  protected readonly roleLabel = computed(() => ROLE_LABELS[this.role()]);
  protected readonly access = computed(() => ACCESS[this.role()]);

  ngOnInit(): void {
    this.checkApi();
  }

  checkApi(): void {
    this.api.set({ kind: ApiStatus.CHECKING });
    this.health.check().subscribe({
      next: () => this.api.set({ kind: ApiStatus.UP, checkedAt: new Date() }),
      error: (err: unknown) =>
        this.api.set({ kind: ApiStatus.DOWN, message: apiErrorMessage(err) }),
    });
  }
}
