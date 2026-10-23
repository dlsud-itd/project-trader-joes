/** `open` accepts applications and shows on the careers page; `closed` stops intake. */
export type JobPostingStatus = 'open' | 'closed';

export const STATUS_LABELS: Record<JobPostingStatus, string> = {
  open: 'Open',
  closed: 'Closed',
};

/** Limits enforced by the API (backend CreateJobPostingDto). */
export const POSTING_LIMITS = {
  title: { min: 3, max: 150 },
  department: 100,
  location: 150,
  description: { min: 20, max: 5000 },
  requirements: { count: 25, length: 200 },
} as const;

export interface PostingAuthor {
  id: number;
  first_name: string;
  last_name: string;
}

/** A posting as staff see it (GET /api/job-postings while signed in). */
export interface JobPosting {
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
}

export interface JobPostingInput {
  title: string;
  department: string;
  location: string;
  description: string;
  requirements: string;
  status?: JobPostingStatus;
}

export interface JobPostingResponse {
  message: string;
  job_posting: JobPosting;
}

export function splitRequirements(text: string | null | undefined): string[] {
  return (text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}
