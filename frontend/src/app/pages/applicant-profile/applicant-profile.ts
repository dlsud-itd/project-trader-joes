import { DatePipe } from '@angular/common';
import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AiScreening, AiScreeningsService } from '../../core/ai-screenings';
import { apiErrorMessage } from '../../core/api/api-error';
import { ApplicationRow, ApplicationsService } from '../../core/applications';
import { RatingAverage } from '../../core/reviews';
import { FitScoreCard } from '../../shared/fit-score-card';
import { RatingAverageBadge } from '../../shared/rating-average';
import { ResumeViewer } from '../../shared/resume-viewer';
import {
  NO_RESUME_MESSAGE,
  SCORE_FAILED_MESSAGE,
} from '../applications/applications';
import { initials } from '../applications/initials';
import { NotesAndRating } from './notes-and-rating';

const LOAD_FAILED_MESSAGE = 'Could not load this applicant.';

/** "https://meilin.dev/" → "meilin.dev". */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/**
 * One applicant's full profile (WBS 4.4): contact details, cover note,
 * AI fit score, and their resume in an inline PDF viewer.
 */
@Component({
  selector: 'app-applicant-profile',
  imports: [
    DatePipe,
    RouterLink,
    FitScoreCard,
    NotesAndRating,
    RatingAverageBadge,
    ResumeViewer,
  ],
  templateUrl: './applicant-profile.html',
  styleUrl: './applicant-profile.scss',
})
export class ApplicantProfile {
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  private readonly applicationsApi = inject(ApplicationsService);
  private readonly screeningsApi = inject(AiScreeningsService);

  /** From the route: /applications/:id */
  readonly id = input.required<string>();

  protected readonly application = signal<ApplicationRow | null>(null);
  protected readonly isLoading = signal(true);
  /** Set for errors other than "not found"; offers a retry. */
  protected readonly loadError = signal<string | null>(null);
  /** Why the last Score / Re-score could not run. */
  protected readonly actionError = signal<string | null>(null);

  protected readonly initials = computed(() =>
    initials(this.application()?.full_name ?? ''),
  );

  /** True while a screening is in flight. */
  protected readonly isScoring = signal(false);

  protected readonly displayUrl = displayUrl;

  constructor() {
    // Load again whenever the route id changes.
    effect(() => this.load(this.id()));
    effect(() => {
      const name = this.isLoading()
        ? 'Applicant'
        : (this.application()?.full_name ?? 'Applicant not found');
      this.title.setTitle(`${name} · Applications · TalentFlow`);
    });
  }

  load(id = this.id()): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.application.set(null);
    this.applicationsApi
      .get(Number(id))
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (row: ApplicationRow) => this.application.set(row),
        error: (err: unknown) => {
          const isNotFound =
            err instanceof HttpErrorResponse &&
            err.status === HttpStatusCode.NotFound;
          // Not found shows the "Applicant not found" message instead.
          if (!isNotFound) {
            this.loadError.set(apiErrorMessage(err, LOAD_FAILED_MESSAGE));
          }
        },
      });
  }
  /** Keeps the rating in the header in step with the Notes and rating card. */
  protected updateRating(rating: RatingAverage): void {
    const row = this.application();
    if (row) this.application.set({ ...row, rating });
  }

  protected updateNoteCount(note_count: number): void {
    const row = this.application();
    if (row) this.application.set({ ...row, note_count });
  }

  /** Score resume / Re-score / Retry. Each call uses Gemini quota. */
  protected score(): void {
    const row = this.application();
    if (!row || this.isScoring()) return;
    this.actionError.set(null);
    if (!row.resume) {
      this.actionError.set(NO_RESUME_MESSAGE);
      return;
    }
    this.isScoring.set(true);
    this.screeningsApi
      .screenOrRetry(row.id, row.screening !== null)
      .pipe(
        finalize(() => this.isScoring.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (screening: AiScreening) =>
          this.application.set({ ...row, screening }),
        error: (err: unknown) =>
          this.actionError.set(apiErrorMessage(err, SCORE_FAILED_MESSAGE)),
      });
  }
}
