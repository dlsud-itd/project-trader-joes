import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';
import { DatePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppPath } from '../../../core/app-paths';
import {
  ApplicationRow,
  KANBAN_STAGES,
  KanbanStage,
} from '../../../core/applications';
import { FitScoreBadge } from '../../../shared/fit-score-badge';
import { initials } from '../initials';

/** Applied date on each card, e.g. "Nov 6". */
const CARD_DATE_FORMAT = 'MMM d';

/** A request to move one applicant to another stage. */
export type StageMove = {
  row: ApplicationRow;
  stage: KanbanStage;
};

type BoardColumn = {
  stage: KanbanStage;
  rows: ApplicationRow[];
};

/**
 * Board view of the Applications page (WBS 4.4.2, 4.4.3): one column per
 * pipeline stage. Managers drag a card to another column, or pick the stage
 * from the card's menu, to move the applicant. Saving is left to the page.
 */
@Component({
  selector: 'app-applications-board',
  imports: [
    CdkDrag,
    CdkDropList,
    CdkDropListGroup,
    DatePipe,
    FitScoreBadge,
    RouterLink,
  ],
  templateUrl: './applications-board.html',
  styleUrl: './applications-board.scss',
})
export class ApplicationsBoard {
  /** Applicants to show, already filtered and sorted by the page. */
  readonly rows = input.required<ApplicationRow[]>();
  /** False for recruiters, who can only view the board. */
  readonly canMove = input(false);
  /** Applicants whose stage change is still saving. */
  readonly moving = input<ReadonlySet<number>>(new Set());

  readonly move = output<StageMove>();

  protected readonly stages = KANBAN_STAGES;
  protected readonly initials = initials;
  protected readonly profilePath = AppPath.APPLICATIONS;
  protected readonly dateFormat = CARD_DATE_FORMAT;

  protected readonly columns = computed<BoardColumn[]>(() =>
    KANBAN_STAGES.map((stage: KanbanStage) => ({
      stage,
      rows: this.rows().filter(
        (row: ApplicationRow) => row.kanban_stage === stage,
      ),
    })),
  );

  protected isMoving(id: number): boolean {
    return this.moving().has(id);
  }

  protected drop(
    event: CdkDragDrop<KanbanStage, KanbanStage, ApplicationRow>,
  ): void {
    // Dropped back in its own column: the order there comes from the sort.
    if (event.previousContainer === event.container) return;
    this.moveTo(event.item.data, event.container.data);
  }

  /** The card's stage menu gives the option's text value back. */
  protected pickStage(row: ApplicationRow, value: string): void {
    const stage = KANBAN_STAGES.find((s: KanbanStage) => s === value);
    if (stage) this.moveTo(row, stage);
  }

  private moveTo(row: ApplicationRow, stage: KanbanStage): void {
    if (row.kanban_stage === stage) return;
    this.move.emit({ row, stage });
  }
}
