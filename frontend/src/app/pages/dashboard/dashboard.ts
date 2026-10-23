import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { apiErrorMessage } from '../../core/api/api-error';
import { HealthService } from '../../core/api/health.service';
import { ROLE_LABELS, UserRole } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';

type ApiState =
  | { kind: 'checking' }
  | { kind: 'up'; checkedAt: Date }
  | { kind: 'down'; message: string };

/** What each role can do, from the TalentFlow user stories. */
const ACCESS: Record<UserRole, string[]> = {
  manager: [
    'Create, edit, and close job postings',
    'Assign recruiters to postings',
    'Manage the applicant pipeline',
    'View the recruitment dashboard',
    'Create staff accounts',
  ],
  recruiter: [
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

  protected readonly api = signal<ApiState>({ kind: 'checking' });
  protected readonly apiUrl = environment.apiUrl;

  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    return `${part}, ${this.auth.user()?.first_name ?? ''}`;
  });

  protected readonly role = computed(() => this.auth.user()?.role ?? 'recruiter');
  protected readonly roleLabel = computed(() => ROLE_LABELS[this.role()]);
  protected readonly access = computed(() => ACCESS[this.role()]);

  ngOnInit(): void {
    void this.checkApi();
  }

  async checkApi(): Promise<void> {
    this.api.set({ kind: 'checking' });
    try {
      await this.health.check();
      this.api.set({ kind: 'up', checkedAt: new Date() });
    } catch (err) {
      this.api.set({ kind: 'down', message: apiErrorMessage(err) });
    }
  }
}
