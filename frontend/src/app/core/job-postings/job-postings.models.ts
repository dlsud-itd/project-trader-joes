/**
 * `OPEN` accepts applications and shows on the careers page;
 * `CLOSED` stops intake. Values match what the API sends.
 */
export enum JobPostingStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

export const STATUS_LABELS: Record<JobPostingStatus, string> = {
  [JobPostingStatus.OPEN]: 'Open',
  [JobPostingStatus.CLOSED]: 'Closed',
};

/** Limits enforced by the API (backend CreateJobPostingDto). */
export enum PostingLimit {
  TITLE_MIN = 3,
  TITLE_MAX = 150,
  DEPARTMENT_MAX = 100,
  LOCATION_MAX = 150,
  DESCRIPTION_MIN = 20,
  DESCRIPTION_MAX = 5000,
  REQUIREMENTS_MAX = 25,
  REQUIREMENT_LENGTH_MAX = 200,
}

export type PostingAuthor = {
  id: number;
  first_name: string;
  last_name: string;
};

/** A posting as staff see it (GET /api/job-postings while signed in). */
export type JobPosting = {
  id: number;
  title: string;
  department: string;
  location: string;
  description: string;
  /** One requirement per line. Use splitRequirements() to get a list. */
  requirements: string;
  status: JobPostingStatus;
  created_by: number;
  created_at: string;
  updated_at: string;
  author?: PostingAuthor | null;
};

export type JobPostingInput = {
  title: string;
  department: string;
  location: string;
  description: string;
  requirements: string;
  status?: JobPostingStatus;
};

export type JobPostingResponse = {
  message: string;
  job_posting: JobPosting;
};

/** DELETE /api/job-postings/:id only sends a message back. */
export type DeleteJobPostingResponse = {
  message: string;
};

export function splitRequirements(text: string | null | undefined): string[] {
  return (text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}
