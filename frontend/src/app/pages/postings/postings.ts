import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import {
  JobPosting,
  JobPostingStatus,
  STATUS_LABELS,
  splitRequirements,
} from '../../core/job-postings/job-postings.models';
import { JobPostingsService } from '../../core/job-postings/job-postings.service';

type Filter = 'all' | JobPostingStatus;

const PREVIEW_REQUIREMENTS = 4;

/**
 * Lists every job posting for signed-in staff.
 * Managers can also create, edit, and open or close postings from here.
 */
@Component({
  selector: 'app-postings',
  imports: [DatePipe, RouterLink],
  templateUrl: './postings.html',
  styleUrl: './postings.scss',
})
export class Postings implements OnInit {
  private readonly postingsApi = inject(JobPostingsService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Set by the form after saving: highlights that posting. */
  readonly saved = input<string>();
  readonly action = input<'created' | 'updated'>();

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly canManage = computed(() => this.auth.hasRole('manager'));
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly postings = signal<JobPosting[]>([]);
  protected readonly filter = signal<Filter>('all');
  protected readonly query = signal('');
  protected readonly pending = signal<ReadonlySet<number>>(new Set());
  protected readonly confirming = signal<JobPosting | null>(null);
  protected readonly flash = signal<string | null>(null);
  private readonly highlightId = signal<number | null>(null);

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('confirmDialog');

  protected readonly counts = computed(() => {
    const all = this.postings();
    return {
      all: all.length,
      open: all.filter((p) => p.status === 'open').length,
      closed: all.filter((p) => p.status === 'closed').length,
    };
  });

  protected readonly visible = computed(() => {
    const filter = this.filter();
    const q = this.query().trim().toLowerCase();
    return this.postings().filter(
      (p) =>
        (filter === 'all' || p.status === filter) &&
        (!q || [p.title, p.department, p.location].some((text) => text.toLowerCase().includes(q))),
    );
  });

  protected readonly filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'closed', label: 'Closed' },
  ];

  async ngOnInit(): Promise<void> {
    const savedId = Number(this.saved());
    if (savedId) {
      this.highlightId.set(savedId);
      this.flash.set(this.action() === 'updated' ? 'Changes saved.' : 'Job posting created.');
      // Drop ?saved=… so a refresh doesn't show the message again.
      void this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      this.postings.set(await this.postingsApi.list());
    } catch (err) {
      this.loadError.set(apiErrorMessage(err, 'Could not load job postings.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected isHighlighted(posting: JobPosting): boolean {
    return this.highlightId() === posting.id;
  }

  protected requirementsPreview(posting: JobPosting): { shown: string[]; more: number } {
    const all = splitRequirements(posting.requirements);
    return {
      shown: all.slice(0, PREVIEW_REQUIREMENTS),
      more: Math.max(0, all.length - PREVIEW_REQUIREMENTS),
    };
  }

  /** Closing asks first because it stops intake; reopening happens right away. */
  protected toggle(posting: JobPosting): void {
    if (posting.status === 'open') {
      this.confirming.set(posting);
      this.dialog()?.nativeElement.showModal();
    } else {
      void this.setStatus(posting, 'open');
    }
  }

  protected async confirmClose(): Promise<void> {
    const posting = this.confirming();
    this.cancelClose();
    if (posting) await this.setStatus(posting, 'closed');
  }

  protected cancelClose(): void {
    this.dialog()?.nativeElement.close();
    this.confirming.set(null);
  }

  private async setStatus(posting: JobPosting, status: JobPostingStatus): Promise<void> {
    this.actionError.set(null);
    this.flash.set(null);
    this.pending.update((set) => new Set(set).add(posting.id));
    try {
      const { job_posting } = await this.postingsApi.setStatus(posting.id, status);
      this.postings.update((list) =>
        list.map((p) => (p.id === posting.id ? { ...p, ...job_posting, author: p.author } : p)),
      );
      this.flash.set(
        status === 'open'
          ? `“${posting.title}” is open and back on the careers page.`
          : `“${posting.title}” is closed and no longer accepts applications.`,
      );
    } catch (err) {
      this.actionError.set(apiErrorMessage(err, 'Could not update the posting.'));
    } finally {
      this.pending.update((set) => {
        const next = new Set(set);
        next.delete(posting.id);
        return next;
      });
    }
  }
}
