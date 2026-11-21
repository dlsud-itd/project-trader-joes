import { DatePipe, DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { AppPath } from '../../core/app-paths';
import {
  ApplicantLink,
  applicantLink,
  ApplicantLinkFilters,
  KanbanStage,
} from '../../core/applications';
import { ROLE_LABELS, StaffRole, UserRole } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import {
  DashboardService,
  DashboardSummary,
  percent,
} from '../../core/dashboard';
import { PostingBreakdown } from './posting-breakdown';
import { StageBar, StageChart } from './stage-chart';

/** Hours (24h clock) where the greeting changes. */
const AFTERNOON_STARTS_AT = 12;
const EVENING_STARTS_AT = 18;

/** After this long, explain that the free-tier API may be waking up. */
const SLOW_LOAD_MS = 5000;

const LOAD_FAILED_MESSAGE = 'Could not load the dashboard.';

/** One summary card at the top. Postings open the Job postings page. */
export type MetricCard = {
  id: 'postings' | 'candidates' | 'new' | 'awaiting';
  label: string;
  value: number;
  hint: string;
  link: ApplicantLink;
};

/**
 * Recruiter dashboard (WBS 4.5.4.1): open postings, candidates, and how
 * many applicants sit in each pipeline stage. Managers see every posting;
 * recruiters see the postings they are assigned to. Every number links to
 * the Applications page with the matching filter already applied.
 */
@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, DecimalPipe, RouterLink, StageChart, PostingBreakdown],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private readonly dashboardApi = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);

  /** Set to 1 when roleGuard redirects here. */
  readonly denied = input<string>();

  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isSlow = signal(false);
  protected readonly loadError = signal<string | null>(null);

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
  /** Recruiters' links narrow Applications to their own postings. */
  private readonly isScoped = computed(
    () => this.summary()?.scope === 'assigned',
  );

  protected readonly scopeText = computed(() => {
    const s = this.summary();
    if (!s) return '';
    if (s.scope === 'all') return 'Across every job posting.';
    const n = s.postings.total;
    return n === 1
      ? 'For the 1 posting you’re assigned to.'
      : `For the ${n} postings you’re assigned to.`;
  });

  /** A recruiter with no assignments has nothing to show yet. */
  protected readonly hasNoPostings = computed(
    () => this.isScoped() && this.summary()?.postings.total === 0,
  );

  protected readonly cards = computed<MetricCard[]>(() => {
    const s = this.summary();
    if (!s) return [];
    const active =
      s.candidates.total - this.stageCount(s, KanbanStage.REJECTED);
    return [
      {
        id: 'postings',
        label: 'Open postings',
        value: s.postings.open,
        hint: `${s.postings.closed} closed`,
        link: { path: AppPath.POSTINGS, queryParams: {} },
      },
      {
        id: 'candidates',
        label: 'Total candidates',
        value: s.candidates.total,
        hint: `${active} still in the running`,
        link: this.link({}),
      },
      {
        id: 'new',
        label: 'New this week',
        value: s.candidates.new_this_week,
        hint: 'Applied in the last 7 days',
        link: this.link({ appliedWithinDays: 7 }),
      },
      {
        id: 'awaiting',
        label: 'Awaiting your rating',
        value: s.candidates.awaiting_your_rating,
        hint: 'Not rated by you yet',
        link: this.link({ review: 'unrated' }),
      },
    ];
  });

  protected readonly bars = computed<StageBar[]>(() => {
    const s = this.summary();
    if (!s) return [];
    const max = Math.max(0, ...s.stages.map((x) => x.count));
    return s.stages.map(({ stage, count }) => ({
      stage,
      count,
      share: percent(count, s.candidates.total),
      width: percent(count, max),
      link: this.link({ stage }),
    }));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.isSlow.set(false);
    this.loadError.set(null);
    const slow = setTimeout(() => this.isSlow.set(true), SLOW_LOAD_MS);
    this.dashboardApi
      .summary()
      .pipe(
        finalize(() => {
          clearTimeout(slow);
          this.isLoading.set(false);
          this.isSlow.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (summary: DashboardSummary) => this.summary.set(summary),
        error: (err: unknown) =>
          this.loadError.set(apiErrorMessage(err, LOAD_FAILED_MESSAGE)),
      });
  }

  /** Adds "my postings" to every link when the numbers are a recruiter's. */
  private link(filters: ApplicantLinkFilters): ApplicantLink {
    return applicantLink({ ...filters, mine: this.isScoped() || undefined });
  }

  private stageCount(s: DashboardSummary, stage: KanbanStage): number {
    return s.stages.find((x) => x.stage === stage)?.count ?? 0;
  }
}
