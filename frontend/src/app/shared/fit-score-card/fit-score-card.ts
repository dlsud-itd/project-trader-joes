import { DatePipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import {
  AiScreening,
  countMatches,
  MATCH_LABEL,
  RequirementMatchLevel,
  ScreeningStatus,
} from '../../core/ai-screenings';
import { FitScoreBadge } from '../fit-score-badge';

/** Requirements shown before "Show all". */
export const FIT_CARD_COLLAPSED_ROWS = 5;

let nextId = 0;

/**
 * The fit score breakdown and written justification for one application
 * (WBS 4.3.3.2): the score, how many requirements the resume meets, the
 * AI's explanation, and the evidence for each requirement.
 */
@Component({
  selector: 'app-fit-score-card',
  imports: [DatePipe, FitScoreBadge],
  templateUrl: './fit-score-card.html',
  styleUrl: './fit-score-card.scss',
})
export class FitScoreCard {
  /** The saved screening; null when the application hasn't been screened. */
  readonly screening = input<AiScreening | null | undefined>(null);
  /** True while a screening request is in flight. */
  readonly busy = input(false);

  /** First screening for this application. */
  readonly run = output<void>();
  /** Score again: after a failure, or to refresh a finished one. */
  readonly retry = output<void>();

  protected readonly titleId = `fit-card-title-${nextId++}`;
  protected readonly matchLabel = MATCH_LABEL;
  protected readonly ScreeningStatus = ScreeningStatus;
  protected readonly MatchLevel = RequirementMatchLevel;
  protected readonly levels: RequirementMatchLevel[] = Object.values(
    RequirementMatchLevel,
  );
  protected readonly expanded = signal(false);

  protected readonly matches = computed(
    () => this.screening()?.requirement_matches ?? [],
  );
  protected readonly counts = computed(() => countMatches(this.matches()));

  protected readonly visibleMatches = computed(() =>
    this.expanded()
      ? this.matches()
      : this.matches().slice(0, FIT_CARD_COLLAPSED_ROWS),
  );
  protected readonly hiddenCount = computed(
    () => this.matches().length - this.visibleMatches().length,
  );

  protected readonly isScored = computed(
    () =>
      !this.busy() &&
      this.screening()?.status === ScreeningStatus.COMPLETED &&
      this.screening()?.fit_score != null,
  );

  /** Width of each bar segment, as a percentage of all requirements. */
  protected share(level: RequirementMatchLevel): number {
    const { total } = this.counts();
    return total ? (this.counts()[level] / total) * 100 : 0;
  }
}
