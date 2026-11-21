import { KanbanStage } from '../applications';
import { JobPostingStatus } from '../job-postings';

/** Applicants per stage. Every stage is present, zeros included. */
export type StageCounts = Record<KanbanStage, number>;

/** One posting under the stage chart. */
export type PostingMetrics = {
  id: number;
  title: string;
  department: string;
  status: JobPostingStatus;
  candidates: number;
  /** Everyone except Rejected. */
  active: number;
  stages: StageCounts;
};

/** GET /api/dashboard. */
export type DashboardSummary = {
  /** `all` for managers; `assigned` when it covers a recruiter's postings. */
  scope: 'all' | 'assigned';
  postings: { open: number; closed: number; total: number };
  candidates: {
    total: number;
    /** Applied in the last 7 days. */
    new_this_week: number;
    /** Not rejected, and not rated by you yet. */
    awaiting_your_rating: number;
  };
  /** Board order: Applied, Screening, Interview, Offer, Rejected. */
  stages: { stage: KanbanStage; count: number }[];
  /** Open postings first, then the busiest. */
  by_posting: PostingMetrics[];
  generated_at: string;
};

/** Share of `part` in `whole`, 0–100, rounded; 0 when there is no whole. */
export function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}
