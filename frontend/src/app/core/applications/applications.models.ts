import { AiScreening } from '../ai-screenings';

/** Pipeline stages, in board order. Values match what the API sends. */
export enum KanbanStage {
  APPLIED = 'Applied',
  SCREENING = 'Screening',
  INTERVIEW = 'Interview',
  OFFER = 'Offer',
  REJECTED = 'Rejected',
}

/** One application in GET /api/applications. */
export type ApplicationRow = {
  id: number;
  job_posting_id: number;
  posting_title: string;
  full_name: string;
  email: string;
  kanban_stage: KanbanStage;
  submitted_at: string;
  /** False until the resume upload finishes; screening needs a resume. */
  has_resume: boolean;
  /** Null until the resume has been screened. */
  screening: AiScreening | null;
};
