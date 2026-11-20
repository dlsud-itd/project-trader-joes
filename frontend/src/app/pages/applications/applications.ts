import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  OnInit,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { finalize, map } from 'rxjs';
import {
  AiScreening,
  AiScreeningsService,
  FIT_TIER_LABEL,
  FitTier,
  fitTier,
  ScreeningStatus,
} from '../../core/ai-screenings';
import { apiErrorMessage } from '../../core/api/api-error';
import {
  ApplicationRow,
  ApplicationsService,
  KanbanStage,
  StageUpdate,
} from '../../core/applications';
import { UserRole } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { FitScoreBadge } from '../../shared/fit-score-badge';
import { RatingAverageBadge } from '../../shared/rating-average';
import {
  ApplicantCompare,
  COMPARE_PARAM,
  compareParam,
  MAX_COMPARE,
  MIN_COMPARE,
  parseCompareIds,
  pickRows,
} from './applicant-compare';
import { ApplicantDetail } from './applicant-detail';
import {
  ApplicantQuery,
  clearFilters,
  DEFAULT_QUERY,
  matchesQuery,
  postingOptions,
  SearchToolbar,
  sortApplications,
} from './applicant-search';
import { ApplicationsBoard, StageMove } from './applications-board';
import { ApplicationsView, VIEW_PARAM } from './applications-view';
import { initials } from './initials';
import { ViewToggle } from './view-toggle';

/** Quick filters: every applicant, a fit tier, or not scored yet. */
export type FitFilter = 'all' | FitTier | 'unscored';

/** Shown when a stage change could not be saved; the card moves back. */
export const moveFailedMessage = ({ row, stage }: StageMove): string =>
  `Could not move ${row.full_name} to ${stage}. Try again.`;

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
 * (WBS 4.3.3.2, 4.4). The List view shows the score breakdown for the picked
 * applicant; the Board view groups applicants by pipeline stage, where
 * managers drag them between stages (WBS 4.4.2, 4.4.3). Both views share
 * the search, filters, two-level sort, and quick filters (WBS 4.5.1.1).
 * Ticking applicants and pressing Compare opens them side by side in the
 * page, with Back to list (WBS 4.5.3.1).
 */
@Component({
  selector: 'app-applications',
  imports: [
    DatePipe,
    NgTemplateOutlet,
    FitScoreBadge,
    RatingAverageBadge,
    ApplicantCompare,
    ApplicantDetail,
    ApplicationsBoard,
    SearchToolbar,
    ViewToggle,
  ],
  templateUrl: './applications.html',
  styleUrl: './applications.scss',
})
export class Applications implements OnInit {
  private readonly applicationsApi = inject(ApplicationsService);
  private readonly screeningsApi = inject(AiScreeningsService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly detail = viewChild<ElementRef<HTMLElement>>('detail');

  protected readonly ApplicationsView = ApplicationsView;
  protected readonly view = toSignal(
    this.route.queryParamMap.pipe(
      map((params: ParamMap) =>
        params.get(VIEW_PARAM) === ApplicationsView.BOARD
          ? ApplicationsView.BOARD
          : ApplicationsView.LIST,
      ),
    ),
    { initialValue: ApplicationsView.LIST },
  );
  /** Only managers move applicants; recruiters see the board read-only. */
  protected readonly canMove = computed(() =>
    this.auth.hasRole(UserRole.MANAGER),
  );
  /** Applications with a stage change still saving. */
  protected readonly moving = signal<ReadonlySet<number>>(new Set());

  /** Ids in `?compare=`; the compare view shows while there are any. */
  protected readonly compareIds = toSignal(
    this.route.queryParamMap.pipe(
      map((params: ParamMap) => parseCompareIds(params.get(COMPARE_PARAM))),
    ),
    { initialValue: [] },
  );
  protected readonly isComparing = computed(() => this.compareIds().length > 0);
  /** Ticked applicants, in the order they were ticked. */
  protected readonly picked = signal<readonly number[]>([]);
  protected readonly compared = computed(() =>
    pickRows(this.rows(), this.compareIds()),
  );
  protected readonly minCompare = MIN_COMPARE;
  protected readonly maxCompare = MAX_COMPARE;
  protected readonly isPickFull = computed(
    () => this.picked().length >= MAX_COMPARE,
  );

  protected readonly rows = signal<ApplicationRow[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  /** Why the last Score / Re-score could not run (not a failed screening). */
  protected readonly actionError = signal<string | null>(null);
  /** Search, filters, and sort from the toolbar. */
  protected readonly search = signal<ApplicantQuery>(DEFAULT_QUERY);
  protected readonly filter = signal<FitFilter>('all');
  protected readonly selectedId = signal<number | null>(null);
  /** Applications with a screening in flight. */
  protected readonly scoring = signal<ReadonlySet<number>>(new Set());

  protected readonly postings = computed(() => postingOptions(this.rows()));

  /** Rows matching the search and filters, before the fit filter. */
  private readonly searched = computed(() => {
    const query = this.search();
    const now = new Date();
    return this.rows().filter((r: ApplicationRow) =>
      matchesQuery(r, query, now),
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
    const { sort, thenBy } = this.search();
    return sortApplications(list, [sort, thenBy]);
  });

  protected readonly selected = computed(
    () => this.rows().find((r) => r.id === this.selectedId()) ?? null,
  );

  protected readonly initials = initials;

  constructor() {
    // A shared or refreshed compare link ticks the same applicants, so
    // Back to list keeps them picked.
    effect(() => {
      const ids = this.compareIds();
      if (ids.length) untracked(() => this.picked.set(ids));
    });
  }

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

  /** "Clear filters" when nothing matches: the toolbar and the fit chips. */
  protected clearAllFilters(): void {
    this.search.update(clearFilters);
    this.filter.set('all');
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

  protected isPicked(id: number): boolean {
    return this.picked().includes(id);
  }

  /** Ticks or unticks an applicant for Compare; up to four at a time. */
  protected togglePick(row: ApplicationRow): void {
    this.picked.update((ids: readonly number[]) => {
      if (ids.includes(row.id)) {
        return ids.filter((id: number) => id !== row.id);
      }
      return ids.length < MAX_COMPARE ? [...ids, row.id] : ids;
    });
  }

  protected clearPicks(): void {
    this.picked.set([]);
  }

  /** Opens the ticked applicants side by side (a new history entry). */
  protected openCompare(): void {
    if (this.picked().length < MIN_COMPARE) return;
    this.setCompare(this.picked());
  }

  protected closeCompare(): void {
    this.setCompare([]);
  }

  /** Drops one applicant from the open comparison and from the ticks. */
  protected removeFromCompare(id: number): void {
    const rest = this.compareIds().filter((other: number) => other !== id);
    this.picked.set(rest);
    this.setCompare(rest);
  }

  private setCompare(ids: readonly number[]): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [COMPARE_PARAM]: compareParam(ids) },
      queryParamsHandling: 'merge',
    });
  }

  protected setView(view: ApplicationsView): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        [VIEW_PARAM]: view === ApplicationsView.BOARD ? view : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /**
   * Moves the card straight away, then saves the new stage. If saving
   * fails, the card goes back to where it was and the error is shown.
   */
  protected moveStage(move: StageMove): void {
    const { row, stage } = move;
    if (this.moving().has(row.id)) return;
    this.actionError.set(null);
    const previous = row.kanban_stage;
    this.setStage(row.id, stage);
    this.moving.update((ids: ReadonlySet<number>) => toggle(ids, row.id, true));

    this.applicationsApi
      .updateStage(row.id, stage)
      .pipe(
        finalize(() =>
          this.moving.update((ids: ReadonlySet<number>) =>
            toggle(ids, row.id, false),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (saved: StageUpdate) =>
          this.setStage(saved.id, saved.kanban_stage),
        error: (err: unknown) => {
          this.setStage(row.id, previous);
          this.actionError.set(apiErrorMessage(err, moveFailedMessage(move)));
        },
      });
  }

  private setStage(id: number, stage: KanbanStage): void {
    this.rows.update((rows: ApplicationRow[]) =>
      rows.map((r: ApplicationRow) =>
        r.id === id ? { ...r, kanban_stage: stage } : r,
      ),
    );
  }

  private setScoring(id: number, isBusy: boolean): void {
    this.scoring.update((ids: ReadonlySet<number>) => toggle(ids, id, isBusy));
  }
}

/** A copy of `ids` with `id` added (on) or removed (off). */
function toggle(
  ids: ReadonlySet<number>,
  id: number,
  isOn: boolean,
): ReadonlySet<number> {
  const next = new Set(ids);
  if (isOn) next.add(id);
  else next.delete(id);
  return next;
}
