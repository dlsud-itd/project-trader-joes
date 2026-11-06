import { AiScreening } from '../ai-screenings';
import { ResumeSummary } from '../resumes';

/** Pipeline stages, in board order. Values match what the API sends. */
export enum KanbanStage {
  APPLIED = 'Applied',
  SCREENING = 'Screening',
  INTERVIEW = 'Interview',
  OFFER = 'Offer',
  REJECTED = 'Rejected',
}

/** Every stage, in board order (one board column each). */
export const KANBAN_STAGES: readonly KanbanStage[] = Object.values(KanbanStage);

/** The saved stage from PATCH /api/applications/:id/stage. */
export type StageUpdate = {
  id: number;
  kanban_stage: KanbanStage;
  updated_at: string;
};

/** Response body of PATCH /api/applications/:id/stage. */
export type StageUpdateResponse = {
  message: string;
  application: StageUpdate;
};

/** One application in GET /api/applications and /api/applications/:id. */
export type ApplicationRow = {
  id: number;
  job_posting_id: number;
  posting_title: string;
  full_name: string;
  email: string;
  phone: string | null;
  portfolio_url: string | null;
  cover_note: string | null;
  kanban_stage: KanbanStage;
  submitted_at: string;
  /** Null when the applicant's upload never finished; screening needs one. */
  resume: ResumeSummary | null;
  /** Null until the resume has been screened. */
  screening: AiScreening | null;
};
