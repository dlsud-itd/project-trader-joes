import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { KANBAN_STAGES, KanbanStage } from '../../../core/applications';
import {
  activeFilterCount,
  APPLIED_LABEL,
  ApplicantQuery,
  AppliedWithin,
  clearFilters,
  DEFAULT_QUERY,
  PostingOption,
  RESUME_LABEL,
  ResumeFilter,
  SORT_LABEL,
  SORT_OPTIONS,
  SortOption,
} from './applicant-search';

/**
 * Search box, filters, and two-level sort above the Applications list and
 * board (WBS 4.5.1.1). The page owns the query; this only edits it.
 */
@Component({
  selector: 'app-search-toolbar',
  imports: [ReactiveFormsModule],
  templateUrl: './search-toolbar.html',
  styleUrl: './search-toolbar.scss',
})
export class SearchToolbar {
  readonly query = input<ApplicantQuery>(DEFAULT_QUERY);
  readonly postings = input<PostingOption[]>([]);
  readonly queryChange = output<ApplicantQuery>();

  private readonly fb = inject(FormBuilder);
  protected readonly form = this.fb.nonNullable.group({
    text: '',
    postingId: this.fb.control<number | null>(null),
    stage: this.fb.control<KanbanStage | null>(null),
    applied: AppliedWithin.ANY,
    resume: ResumeFilter.ANY,
    sort: SortOption.FIT_HIGH,
    thenBy: this.fb.control<SortOption | null>(SortOption.NEWEST),
  });

  protected readonly stages = KANBAN_STAGES;
  protected readonly appliedOptions = Object.values(AppliedWithin);
  protected readonly resumeOptions = Object.values(ResumeFilter);
  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly appliedLabel = APPLIED_LABEL;
  protected readonly resumeLabel = RESUME_LABEL;
  protected readonly sortLabel = SORT_LABEL;

  protected readonly activeCount = computed(() =>
    activeFilterCount(this.query()),
  );

  /** "Then by" leaves out whatever the list is already sorted by. */
  protected readonly thenByOptions = computed(() =>
    SORT_OPTIONS.filter((o: SortOption) => o !== this.query().sort),
  );

  constructor() {
    // Follow the page's query, e.g. when it clears the filters.
    effect(() => {
      const query = this.query();
      untracked(() => this.form.setValue(query, { emitEvent: false }));
    });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      const query = this.form.getRawValue();
      // Sorting twice by the same thing does nothing, so drop the second.
      const isRepeat = query.thenBy === query.sort;
      this.queryChange.emit(isRepeat ? { ...query, thenBy: null } : query);
    });
  }

  protected clear(): void {
    this.form.setValue(clearFilters(this.form.getRawValue()));
  }
}
