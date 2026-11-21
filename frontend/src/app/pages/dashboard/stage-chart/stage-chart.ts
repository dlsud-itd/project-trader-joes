import { DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApplicantLink, KanbanStage } from '../../../core/applications';

/** One bar in the stage chart. */
export type StageBar = {
  stage: KanbanStage;
  count: number;
  /** Share of all candidates, 0–100. */
  share: number;
  /** Bar length against the busiest stage, 0–100. */
  width: number;
  link: ApplicantLink;
};

/**
 * Applicants per pipeline stage: the whole pipeline as one segmented bar,
 * then a bar per stage that opens Applications filtered to it.
 */
@Component({
  selector: 'app-stage-chart',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './stage-chart.html',
  styleUrl: './stage-chart.scss',
})
export class StageChart {
  readonly bars = input.required<StageBar[]>();
  readonly total = input.required<number>();

  protected label(bar: StageBar): string {
    const people = bar.count === 1 ? 'applicant' : 'applicants';
    return `${bar.stage}: ${bar.count} ${people}, ${bar.share}%`;
  }
}
