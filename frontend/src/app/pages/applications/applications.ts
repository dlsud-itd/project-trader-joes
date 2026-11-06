import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import {
  AiScreening,
  AiScreeningsService,
  FIT_TIER_LABEL,
  FitTier,
  fitTier,
  ScreeningStatus,
} from '../../core/ai-screenings';
import { apiErrorMessage } from '../../core/api/api-error';
import { ApplicationRow, ApplicationsService } from '../../core/applications';
import { FitScoreBadge } from '../../shared/fit-score-badge';
import { ApplicantDetail } from './applicant-detail';
import { initials } from './initials';

/** Quick filters: every applicant, a fit tier, or not scored yet. */
export type FitFilter = 'all' | FitTier | 'unscored';
export type SortOrder = 'fit' | 'newest';

/** Which quick filter an application falls under. */
export function fitGroup(row: ApplicationRow): Exclude<FitFilter, 'all'> {
  const s = row.screening;
  const isScored = s?.status === ScreeningStatus.COMPLETED;
  if (!isScored || s?.fit_score == null) return 'unscored';
  return fitTier(s.fit_score);
}

const LOAD_FAILED_MESSAGE = 'Could not load applicants.';
export const SCORE_FAILED_MESSAGE = 'Could not score this resume. Try again.';
export const NO_RESUME_MESSAGE =
  'This applicant has not uploaded a resume yet, so it cannot be scored.';

/**
 * Applications across all postings, with their AI fit scores
 * (WBS 4.3.3.2, 4.4). Pick one to see the score breakdown and explanation.
 */
@Component({
  selector: 'app-applications',
  imports: [DatePipe, FitScoreBadge, ApplicantDetail],
  templateUrl: './applications.html',
  styleUrl: './applications.scss',
})
export class Applications implements OnInit {
  private readonly applicationsApi = inject(ApplicationsService);
  private readonly screeningsApi = inject(AiScreeningsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly detail = viewChild<ElementRef<HTMLElement>>('detail');

  protected readonly rows = signal<ApplicationRow[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  /** Why the last Score / Re-score could not run (not a failed screening). */
  protected readonly actionError = signal<string | null>(null);
  protected readonly query = signal('');
  protected readonly posting = signal('all');
  protected readonly sort = signal<SortOrder>('fit');
  protected readonly filter = signal<FitFilter>('all');
  protected readonly selectedId = signal<number | null>(null);
  /** Applications with a screening in flight. */
  protected readonly scoring = signal<ReadonlySet<number>>(new Set());

  protected readonly postings = computed(() =>
    [...new Set(this.rows().map((r) => r.posting_title))].sort(),
  );

  /** Rows matching the search and posting, before the fit filter. */
  private readonly searched = computed(() => {
    const q = this.query().trim().toLowerCase();
    const posting = this.posting();
    return this.rows().filter(
      (r) =>
        (posting === 'all' || r.posting_title === posting) &&
        (!q ||
          r.full_name.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q)),
    );
  });

  protected readonly filters = computed(() => {
    const counts: Record<FitFilter, number> = {
      all: 0,
      [FitTier.STRONG]: 0,
      [FitTier.POSSIBLE]: 0,
      [FitTier.WEAK]: 0,
      unscored: 0,
    };
    for (const row of this.searched()) {
      counts.all++;
      counts[fitGroup(row)]++;
    }
    return [
      { id: 'all', label: 'All', count: counts.all },
      ...Object.values(FitTier).map((tier: FitTier) => ({
        id: tier,
        label: FIT_TIER_LABEL[tier],
        count: counts[tier],
      })),
      { id: 'unscored', label: 'Not scored', count: counts.unscored },
    ] satisfies { id: FitFilter; label: string; count: number }[];
  });

  protected readonly visible = computed(() => {
    const f = this.filter();
    const list = this.searched().filter(
      (r) => f === 'all' || fitGroup(r) === f,
    );
    return this.sort() === 'fit'
      ? list.sort(
          (a, b) =>
            (b.screening?.fit_score ?? -1) - (a.screening?.fit_score ?? -1),
        )
      : list.sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
  });

  protected readonly selected = computed(
    () => this.rows().find((r) => r.id === this.selectedId()) ?? null,
  );

  protected readonly initials = initials;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.applicationsApi
      .list()
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (list: ApplicationRow[]) => {
          this.rows.set(list);
          // Open the best match once the list is in.
          if (this.selected() === null) {
            this.selectedId.set(this.visible()[0]?.id ?? null);
          }
        },
        error: (err: unknown) =>
          this.loadError.set(apiErrorMessage(err, LOAD_FAILED_MESSAGE)),
      });
  }

  protected select(row: ApplicationRow): void {
    this.selectedId.set(row.id);
    // On narrow screens the panel sits below the list; bring it into view.
    queueMicrotask(() => {
      const panel = this.detail()?.nativeElement;
      if (panel && panel.getBoundingClientRect().top > window.innerHeight) {
        panel.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  protected isScoring(id: number): boolean {
    return this.scoring().has(id);
  }

  /** Score resume / Re-score / Retry for one row. */
  protected score(row: ApplicationRow): void {
    if (this.isScoring(row.id)) return;
    this.actionError.set(null);
    if (!row.resume) {
      this.actionError.set(NO_RESUME_MESSAGE);
      return;
    }
    this.setScoring(row.id, true);

    this.screeningsApi
      .screenOrRetry(row.id, row.screening !== null)
      .pipe(
        finalize(() => this.setScoring(row.id, false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (screening: AiScreening) =>
          this.rows.update((rows: ApplicationRow[]) =>
            rows.map((r: ApplicationRow) =>
              r.id === row.id ? { ...r, screening } : r,
            ),
          ),
        error: (err: unknown) =>
          this.actionError.set(apiErrorMessage(err, SCORE_FAILED_MESSAGE)),
      });
  }

  private setScoring(id: number, isBusy: boolean): void {
    this.scoring.update((ids: ReadonlySet<number>) => {
      const next = new Set(ids);
      if (isBusy) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
