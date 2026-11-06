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
