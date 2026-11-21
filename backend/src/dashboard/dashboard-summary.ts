import {
  type JobPostingStatus,
  type KanbanStage,
  kanbanStageEnum,
} from '../database/schema.js';

/** Pipeline stages in board order, so the chart never reorders. */
export const STAGES: readonly KanbanStage[] = kanbanStageEnum.enumValues;

/** How far back "new this week" looks. */
export const NEW_WINDOW_DAYS = 7;

/** How many applicants are in each stage. Every stage is present. */
export type StageCounts = Record<KanbanStage, number>;

/** One posting row under the stage chart. */
export type PostingMetrics = {
  id: number;
  title: string;
  department: string;
  status: JobPostingStatus;
  candidates: number;
  /** Applicants still moving: everyone except Rejected. */
  active: number;
  stages: StageCounts;
};

/** GET /api/dashboard (WBS 4.5.4.1). */
export type DashboardSummary = {
  /** `all` for managers; `assigned` when only a recruiter's postings count. */
  scope: 'all' | 'assigned';
  postings: { open: number; closed: number; total: number };
  candidates: {
    total: number;
    /** Applied in the last NEW_WINDOW_DAYS days. */
    new_this_week: number;
    /** Not rejected and not rated by the signed-in user yet. */
    awaiting_your_rating: number;
  };
  /** Every stage, in board order, with zeros included. */
  stages: { stage: KanbanStage; count: number }[];
  /** Postings in scope, open first, then by most candidates. */
  by_posting: PostingMetrics[];
  generated_at: string;
};

/** A posting as read from the database. */
export type PostingRow = {
  id: number;
  title: string;
  department: string;
  status: JobPostingStatus;
};

/** One `GROUP BY job_posting_id, kanban_stage` row. */
export type StageRow = {
  job_posting_id: number;
  kanban_stage: KanbanStage;
  count: number;
  new_count: number;
};

export function emptyStages(): StageCounts {
  return Object.fromEntries(STAGES.map((s) => [s, 0])) as StageCounts;
}

/**
 * Builds the response from three small query results. Kept apart from the
 * service so the numbers can be tested without a database.
 */
export function buildSummary(input: {
  scope: DashboardSummary['scope'];
  postings: readonly PostingRow[];
  stageRows: readonly StageRow[];
  awaitingYourRating: number;
  now?: Date;
}): DashboardSummary {
  const totals = emptyStages();
  const byPosting = new Map<number, PostingMetrics>(
    input.postings.map((p) => [
      p.id,
      { ...p, candidates: 0, active: 0, stages: emptyStages() },
    ]),
  );
  let newThisWeek = 0;

  for (const row of input.stageRows) {
    const posting = byPosting.get(row.job_posting_id);
    // Rows outside the scope are ignored, never counted.
    if (!posting) continue;
    totals[row.kanban_stage] += row.count;
    posting.stages[row.kanban_stage] += row.count;
    posting.candidates += row.count;
    if (row.kanban_stage !== 'Rejected') posting.active += row.count;
    newThisWeek += row.new_count;
  }

  const open = input.postings.filter((p) => p.status === 'open').length;
  const total = STAGES.reduce((sum, s) => sum + totals[s], 0);

  return {
    scope: input.scope,
    postings: {
      open,
      closed: input.postings.length - open,
      total: input.postings.length,
    },
    candidates: {
      total,
      new_this_week: newThisWeek,
      awaiting_your_rating: input.awaitingYourRating,
    },
    stages: STAGES.map((stage) => ({ stage, count: totals[stage] })),
    by_posting: [...byPosting.values()].sort(
      (a, b) =>
        Number(b.status === 'open') - Number(a.status === 'open') ||
        b.candidates - a.candidates ||
        a.title.localeCompare(b.title) ||
        a.id - b.id,
    ),
    generated_at: (input.now ?? new Date()).toISOString(),
  };
}
