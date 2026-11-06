import { DatePipe, NgTemplateOutlet } from '@angular/common';
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
import { ApplicantDetail } from './applicant-detail';
import { ApplicationsBoard, StageMove } from './applications-board';
import { ApplicationsView, VIEW_PARAM } from './applications-view';
import { initials } from './initials';
import { ViewToggle } from './view-toggle';

/** Quick filters: every applicant, a fit tier, or not scored yet. */
export type FitFilter = 'all' | FitTier | 'unscored';
export type SortOrder = 'fit' | 'newest';

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
 * the search, posting filter, sort, and quick filters.
 */
@Component({
  selector: 'app-applications',
  imports: [
    DatePipe,
    NgTemplateOutlet,
    FitScoreBadge,
    ApplicantDetail,
    ApplicationsBoard,
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
