import { DatePipe, DecimalPipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize, forkJoin, Observable } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import {
  Note,
  NOTE_MAX_LENGTH,
  RatingAverage,
  RatingSummary,
  ReviewsService,
  timeAgo,
  withMyRating,
} from '../../../core/reviews';
import { RatingAverageBadge } from '../../../shared/rating-average';
import { StarRating } from '../../../shared/star-rating';
import { notBlank } from '../../../shared/validators';

const LOAD_FAILED_MESSAGE = 'Could not load notes and ratings.';
const NOTE_FAILED_MESSAGE = 'Your note wasn’t saved. Try again.';
const RATING_FAILED_MESSAGE = 'Your rating wasn’t saved. Try again.';
/** How often "5 minutes ago" is brought up to date. */
const CLOCK_TICK_MS = 60_000;

/**
 * Shared notes and the 1–5 star rating for one applicant (WBS 4.5.2.2).
 * Notes and ratings show at once and are undone if saving fails.
 */
@Component({
  selector: 'app-notes-and-rating',
  imports: [
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    RatingAverageBadge,
    StarRating,
  ],
  templateUrl: './notes-and-rating.html',
  styleUrl: './notes-and-rating.scss',
})
export class NotesAndRating {
  private readonly reviewsApi = inject(ReviewsService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly applicationId = input.required<number>();
  /** The team average changed, so the page can update it elsewhere. */
  readonly ratingChange = output<RatingAverage>();

  protected readonly maxLength = NOTE_MAX_LENGTH;
  protected readonly notes = signal<Note[]>([]);
  protected readonly summary = signal<RatingSummary | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly noteError = signal<string | null>(null);
  protected readonly ratingError = signal<string | null>(null);
  /** Ids of notes shown before the server confirmed them. */
  protected readonly pendingIds = signal<ReadonlySet<number>>(new Set());
  protected readonly now = signal(new Date());

  protected readonly noteForm = new FormGroup({
    body: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        notBlank,
        Validators.maxLength(NOTE_MAX_LENGTH),
      ],
    }),
  });
  protected readonly draft = this.noteForm.controls.body;

  private nextPendingId = -1;

  constructor() {
    effect(() => this.load(this.applicationId()));
    const clock = setInterval(() => this.now.set(new Date()), CLOCK_TICK_MS);
    this.destroyRef.onDestroy(() => clearInterval(clock));
  }

  load(id: number = this.applicationId()): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    forkJoin({
      notes: this.reviewsApi.listNotes(id),
      summary: this.reviewsApi.getRating(id),
    })
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({
          notes,
          summary,
        }: {
          notes: Note[];
          summary: RatingSummary;
        }) => {
          this.notes.set(notes);
          this.summary.set(summary);
        },
        error: (err: unknown) =>
          this.loadError.set(apiErrorMessage(err, LOAD_FAILED_MESSAGE)),
      });
  }

  protected timeAgo(note: Note): string {
    return timeAgo(note.created_at, this.now());
  }

  protected isPending(note: Note): boolean {
    return this.pendingIds().has(note.id);
  }

  protected isMine(note: Note): boolean {
    return note.author.id === this.auth.user()?.id;
  }

  /** Ctrl+Enter (Cmd+Enter on a Mac) posts the note. */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.post();
    }
  }

  /** Shows the note at once; takes it back out if saving fails. */
  protected post(): void {
    const user = this.auth.user();
    if (this.draft.invalid || !user) {
      this.draft.markAsTouched();
      return;
    }
    const body = this.draft.value.trim();
    const pending: Note = {
      id: this.nextPendingId--,
      application_id: this.applicationId(),
      body,
      created_at: new Date().toISOString(),
      author: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
      },
    };
    this.noteError.set(null);
    this.notes.update((notes: Note[]) => [pending, ...notes]);
    this.setPending(pending.id, true);
    this.draft.reset();

    this.reviewsApi
      .addNote(this.applicationId(), body)
      .pipe(
        finalize(() => this.setPending(pending.id, false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (saved: Note) =>
          this.notes.update((notes: Note[]) =>
            notes.map((n: Note) => (n.id === pending.id ? saved : n)),
          ),
        error: (err: unknown) => {
          this.notes.update((notes: Note[]) =>
            notes.filter((n: Note) => n.id !== pending.id),
          );
          // Give the text back so nothing typed is lost.
          if (!this.draft.value) this.draft.setValue(body);
          this.noteError.set(apiErrorMessage(err, NOTE_FAILED_MESSAGE));
        },
      });
  }

  protected rate(rating: number): void {
    this.saveRating(
      rating,
      this.reviewsApi.setRating(this.applicationId(), rating),
    );
  }

  protected clearRating(): void {
    this.saveRating(null, this.reviewsApi.removeRating(this.applicationId()));
  }

  /** Shows the new rating at once; puts the old one back if saving fails. */
  private saveRating(
    next: number | null,
    request: Observable<RatingSummary>,
  ): void {
    const previous = this.summary();
    if (!previous) return;
    this.ratingError.set(null);
    this.showSummary(withMyRating(previous, next));
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved: RatingSummary) => this.showSummary(saved),
      error: (err: unknown) => {
        this.showSummary(previous);
        this.ratingError.set(apiErrorMessage(err, RATING_FAILED_MESSAGE));
      },
    });
  }

  private showSummary(summary: RatingSummary): void {
    this.summary.set(summary);
    this.ratingChange.emit({ average: summary.average, count: summary.count });
  }

  private setPending(id: number, isPending: boolean): void {
    this.pendingIds.update((ids: ReadonlySet<number>) => {
      const next = new Set(ids);
      if (isPending) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
