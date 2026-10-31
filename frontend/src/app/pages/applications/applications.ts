import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  FIT_TIER_LABEL,
  FitTier,
  fitTier,
  ScreeningStatus,
} from '../../core/ai-screenings';
import { FitScoreBadge } from '../../shared/fit-score-badge';
import { ApplicantDetail } from './applicant-detail';
import { initials } from './initials';
import { ApplicationRow, SAMPLE_APPLICATIONS } from './sample-applications';

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

/** How long a sample screening "takes". */
const SAMPLE_SCORING_MS = 1200;

/**
 * Applications across all postings, with their AI fit scores
 * (WBS 4.3.3.2). Pick one to see the score breakdown and explanation.
 */
@Component({
  selector: 'app-applications',
  imports: [DatePipe, FitScoreBadge, ApplicantDetail],
  templateUrl: './applications.html',
  styleUrl: './applications.scss',
})
export class Applications {
  private readonly destroyRef = inject(DestroyRef);
  private readonly detail = viewChild<ElementRef<HTMLElement>>('detail');

  protected readonly rows = signal<ApplicationRow[]>(
    structuredClone(SAMPLE_APPLICATIONS),
  );
  protected readonly query = signal('');
  protected readonly posting = signal('all');
  protected readonly sort = signal<SortOrder>('fit');
  protected readonly filter = signal<FitFilter>('all');
  protected readonly selectedId = signal<number | null>(
    SAMPLE_APPLICATIONS[0]?.id ?? null,
  );
  /** Applications with a (sample) screening in flight. */
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

  /**
   * Sample stand-in for AiScreeningsService.screen(): waits, then shows the
   * row's prepared result. Swap for the real call with the applications API.
   */
  protected score(row: ApplicationRow): void {
    if (this.isScoring(row.id)) return;
    this.scoring.update((s) => new Set(s).add(row.id));

    const timer = setTimeout(() => {
      this.scoring.update((s) => {
        const next = new Set(s);
        next.delete(row.id);
        return next;
      });
      this.rows.update((rows) =>
        rows.map((r) => {
          if (r.id !== row.id) return r;
          const previous = r.screening;
          const result = r.sample_result ?? previous;
          if (!result) return r;
          return {
            ...r,
            screening: {
              ...result,
              retry_count: previous ? previous.retry_count + 1 : 0,
              screened_at: new Date().toISOString(),
            },
          };
        }),
      );
    }, SAMPLE_SCORING_MS);
    this.destroyRef.onDestroy(() => clearTimeout(timer));
  }
}
