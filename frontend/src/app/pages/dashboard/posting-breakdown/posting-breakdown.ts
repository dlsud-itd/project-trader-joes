import { DecimalPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ApplicantLink,
  applicantLink,
  KANBAN_STAGES,
  KanbanStage,
} from '../../../core/applications';
import { PostingMetrics } from '../../../core/dashboard';
import { JobPostingStatus, STATUS_LABELS } from '../../../core/job-postings';

/** How many postings show before "Show more". */
export const POSTINGS_SHOWN = 5;

/**
 * Candidates per posting, each with a bar split by stage. The title opens
 * Applications for that posting; each bar segment opens that posting and
 * stage.
 */
@Component({
  selector: 'app-posting-breakdown',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './posting-breakdown.html',
  styleUrl: './posting-breakdown.scss',
})
export class PostingBreakdown {
  readonly postings = input.required<PostingMetrics[]>();

  protected readonly stages = KANBAN_STAGES;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly JobPostingStatus = JobPostingStatus;
  protected readonly limit = POSTINGS_SHOWN;
  protected readonly showAll = signal(false);

  protected readonly shown = computed(() =>
    this.showAll() ? this.postings() : this.postings().slice(0, this.limit),
  );
  protected readonly hidden = computed(
    () => this.postings().length - this.shown().length,
  );

  protected link(posting: PostingMetrics, stage?: KanbanStage): ApplicantLink {
    return applicantLink({ postingId: posting.id, stage });
  }

  protected stageTitle(posting: PostingMetrics, stage: KanbanStage): string {
    const n = posting.stages[stage];
    return `${stage}: ${n} ${n === 1 ? 'applicant' : 'applicants'}`;
  }
}
