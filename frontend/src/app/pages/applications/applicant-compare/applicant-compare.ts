import { DatePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MATCH_LABEL } from '../../../core/ai-screenings';
import { AppPath } from '../../../core/app-paths';
import { ApplicationRow } from '../../../core/applications';
import { FitScoreBadge } from '../../../shared/fit-score-badge';
import { RatingAverageBadge } from '../../../shared/rating-average';
import { initials } from '../initials';
import {
  bestFitIds,
  isScreened,
  MIN_COMPARE,
  postingTitles,
  requirementRows,
  sharedPosting,
} from './compare';

/**
 * Two to four applicants for the same job side by side on the
 * Applications page (WBS 4.5.3.1): fit score, rating, stage, resume, and how
 * each one meets that posting's requirements.
 */
@Component({
  selector: 'app-applicant-compare',
  imports: [DatePipe, RouterLink, FitScoreBadge, RatingAverageBadge],
  templateUrl: './applicant-compare.html',
  styleUrl: './applicant-compare.scss',
})
export class ApplicantCompare {
  /** The compared applicants, one column each, in the order picked. */
  readonly rows = input.required<ApplicationRow[]>();

  /** Back to the list or board. */
  readonly back = output<void>();
  /** Drops one applicant from the comparison. */
  readonly remove = output<number>();

  /** The job compared for; null when the applicants applied to different jobs. */
  protected readonly posting = computed(() => sharedPosting(this.rows()));
  protected readonly titles = computed(() => postingTitles(this.rows()));
  protected readonly best = computed(() => bestFitIds(this.rows()));
  protected readonly requirements = computed(() =>
    requirementRows(this.rows()),
  );
  /** Removing is only offered while more than two are compared. */
  protected readonly canRemove = computed(
    () => this.rows().length > MIN_COMPARE,
  );

  protected readonly initials = initials;
  protected readonly isScreened = isScreened;
  protected readonly matchLabel = MATCH_LABEL;
  protected readonly profilePath = AppPath.APPLICATIONS;
}
