import { JobPosting } from '../job-postings';

/** A posting as visitors see it on the careers page (no internal fields). */
export type PublicJobPosting = Pick<
  JobPosting,
  | 'id'
  | 'title'
  | 'department'
  | 'location'
  | 'description'
  | 'requirements'
  | 'status'
  | 'created_at'
>;

/** Limits enforced by the API (backend CreateApplicationDto). */
export enum ApplicationLimit {
  FULL_NAME_MIN = 2,
  FULL_NAME_MAX = 150,
  EMAIL_MAX = 255,
  PORTFOLIO_URL_MAX = 255,
  COVER_NOTE_MAX = 2000,
}

/** Same check as the API: digits, spaces, ( ) and -, optional leading +. */
export const PHONE_PATTERN = /^\+?[\d\s()-]{7,30}$/;

/** A full http(s) link, e.g. https://github.com/name. */
export const URL_PATTERN = /^https?:\/\/\S+\.\S+$/i;

/** Body for POST /api/applications. */
export type ApplicationInput = {
  job_posting_id: number;
  full_name: string;
  email: string;
  phone?: string;
  portfolio_url?: string;
  cover_note?: string;
};

export type ApplicationResponse = {
  message: string;
  application: {
    id: number;
    job_posting_id: number;
    kanban_stage: string;
    submitted_at: string;
  };
  /** Proves the resume upload comes from the same applicant. */
  upload_token: string;
};

export type ResumeResponse = {
  message: string;
  resume: {
    id: number;
    application_id: number;
    file_url: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    uploaded_at: string;
  };
};
