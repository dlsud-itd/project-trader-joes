import { DatePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { FitScoreCard } from '../../../shared/fit-score-card';
import { initials } from '../initials';
import { ApplicationRow } from '../sample-applications';

/** The picked applicant: who they are, and their fit score breakdown. */
@Component({
  selector: 'app-applicant-detail',
  imports: [DatePipe, FitScoreCard],
  templateUrl: './applicant-detail.html',
  styleUrl: './applicant-detail.scss',
})
export class ApplicantDetail {
  readonly application = input.required<ApplicationRow>();
  /** True while a screening is in flight for this applicant. */
  readonly busy = input(false);

  /** Run a first screening, or score again. */
  readonly score = output<void>();

  protected readonly initials = computed(() =>
    initials(this.application().full_name),
  );
}
