import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { UserRole } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import {
  JobPosting,
  JobPostingResponse,
  JobPostingStatus,
  JobPostingsService,
  STATUS_LABELS,
  splitRequirements,
} from '../../core/job-postings';

/** Status tabs above the list. Values match JobPostingStatus. */
enum PostingFilter {
  ALL = 'all',
  OPEN = 'open',
  CLOSED = 'closed',
}

type RequirementsPreview = { shown: string[]; more: number };

const PREVIEW_REQUIREMENTS = 4;

/**
 * Lists every job posting for signed-in staff.
 * Managers can also create, edit, open or close, and delete postings here.
 */
@Component({
  selector: 'app-postings',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './postings.html',
  styleUrl: './postings.scss',
})
export class Postings implements OnInit {
  private readonly postingsApi = inject(JobPostingsService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Set by the form after saving: highlights that posting. */
  readonly saved = input<string>();
  readonly action = input<'created' | 'updated'>();

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly status = JobPostingStatus;
  protected readonly canManage = computed(() =>
    this.auth.hasRole(UserRole.MANAGER),
  );
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly postings = signal<JobPosting[]>([]);
  protected readonly filter = signal<PostingFilter>(PostingFilter.ALL);
  protected readonly searchControl = new FormControl('', {
    nonNullable: true,
  });
  protected readonly pendingIds = signal<ReadonlySet<number>>(new Set());
  protected readonly confirming = signal<JobPosting | null>(null);
  protected readonly deleting = signal<JobPosting | null>(null);
  protected readonly flash = signal<string | null>(null);
  private readonly highlightId = signal<number | null>(null);
  private readonly query = toSignal(this.searchControl.valueChanges, {
    initialValue: '',
  });

  private readonly dialog =
    viewChild<ElementRef<HTMLDialogElement>>('confirmDialog');
  private readonly deleteDialog =
    viewChild<ElementRef<HTMLDialogElement>>('deleteDialog');

  protected readonly counts = computed(() => {
    const all = this.postings();
    const countOf = (status: JobPostingStatus) =>
      all.filter((p: JobPosting) => p.status === status).length;
    return {
      [PostingFilter.ALL]: all.length,
      [PostingFilter.OPEN]: countOf(JobPostingStatus.OPEN),
      [PostingFilter.CLOSED]: countOf(JobPostingStatus.CLOSED),
    };
  });

  protected readonly visible = computed(() => {
    const filter = this.filter();
    const q = this.query().trim().toLowerCase();
    return this.postings().filter(
      (p: JobPosting) =>
        (filter === PostingFilter.ALL || p.status === filter.valueOf()) &&
        (!q ||
          [p.title, p.department, p.location].some((text: string) =>
            text.toLowerCase().includes(q),
          )),
    );
  });

  protected readonly filters: { key: PostingFilter; label: string }[] = [
    { key: PostingFilter.ALL, label: 'All' },
    { key: PostingFilter.OPEN, label: 'Open' },
    { key: PostingFilter.CLOSED, label: 'Closed' },
  ];

  ngOnInit(): void {
    const savedId = Number(this.saved());
    if (savedId) {
      this.highlightId.set(savedId);
      this.flash.set(
        this.action() === 'updated' ? 'Changes saved.' : 'Job posting created.',
      );
      // Drop ?saved=… so a refresh doesn't show the message again.
      void this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.postingsApi
      .list()
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (list: JobPosting[]) => this.postings.set(list),
        error: (err: unknown) =>
          this.loadError.set(
            apiErrorMessage(err, 'Could not load job postings.'),
          ),
      });
  }

  protected clearFilters(): void {
    this.filter.set(PostingFilter.ALL);
    this.searchControl.setValue('');
  }

  protected isHighlighted(posting: JobPosting): boolean {
    return this.highlightId() === posting.id;
  }

  protected requirementsPreview(posting: JobPosting): RequirementsPreview {
    const all = splitRequirements(posting.requirements);
    return {
      shown: all.slice(0, PREVIEW_REQUIREMENTS),
      more: Math.max(0, all.length - PREVIEW_REQUIREMENTS),
    };
  }

  /** Closing asks first because it stops intake; reopening is immediate. */
  protected toggle(posting: JobPosting): void {
    if (posting.status === JobPostingStatus.OPEN) {
      this.confirming.set(posting);
      this.dialog()?.nativeElement.showModal();
    } else {
      this.setStatus(posting, JobPostingStatus.OPEN);
    }
  }

  protected confirmClose(): void {
    const posting = this.confirming();
    this.cancelClose();
    if (posting) this.setStatus(posting, JobPostingStatus.CLOSED);
  }

  protected cancelClose(): void {
    this.dialog()?.nativeElement.close();
    this.confirming.set(null);
  }

  /** Deleting can't be undone, so it always asks first. */
  protected askDelete(posting: JobPosting): void {
    this.deleting.set(posting);
    this.deleteDialog()?.nativeElement.showModal();
  }

  protected cancelDelete(): void {
    this.deleteDialog()?.nativeElement.close();
    this.deleting.set(null);
  }

  /** The API refuses (409) when the posting has applicants. */
  protected confirmDelete(): void {
    const posting = this.deleting();
    this.cancelDelete();
    if (!posting) return;
    this.startAction(posting);
    this.postingsApi
      .remove(posting.id)
      .pipe(
        finalize(() => this.endAction(posting)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.postings.update((list: JobPosting[]) =>
            list.filter((p: JobPosting) => p.id !== posting.id),
          );
          this.flash.set(`“${posting.title}” was deleted.`);
        },
        error: (err: unknown) =>
          this.actionError.set(
            apiErrorMessage(err, 'Could not delete the posting.'),
          ),
      });
  }

  private startAction(posting: JobPosting): void {
    this.actionError.set(null);
    this.flash.set(null);
    this.pendingIds.update((ids: ReadonlySet<number>) =>
      new Set(ids).add(posting.id),
    );
  }

  private endAction(posting: JobPosting): void {
    this.pendingIds.update((ids: ReadonlySet<number>) => {
      const next = new Set(ids);
      next.delete(posting.id);
      return next;
    });
  }

  private setStatus(posting: JobPosting, status: JobPostingStatus): void {
    this.startAction(posting);
    this.postingsApi
      .setStatus(posting.id, status)
      .pipe(
        finalize(() => this.endAction(posting)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ job_posting }: JobPostingResponse) => {
          this.postings.update((list: JobPosting[]) =>
            list.map((p: JobPosting) =>
              p.id === posting.id
                ? { ...p, ...job_posting, author: p.author }
                : p,
            ),
          );
          this.flash.set(this.statusMessage(posting.title, status));
        },
        error: (err: unknown) =>
          this.actionError.set(
            apiErrorMessage(err, 'Could not update the posting.'),
          ),
      });
  }

  private statusMessage(title: string, status: JobPostingStatus): string {
    return status === JobPostingStatus.OPEN
      ? `“${title}” is open and back on the careers page.`
      : `“${title}” is closed and no longer accepts applications.`;
  }
}
