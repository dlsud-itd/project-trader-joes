/** The recruiter on an assignment, as GET /api/job-assignments sends it. */
export type AssignedUser = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
};

/** A recruiter assigned to a job posting (API spec III). */
export type JobAssignment = {
  id: number;
  job_posting_id: number;
  user_id: number;
  assigned_at: string;
};

/** One assignment in GET /api/job-assignments. */
export type JobAssignmentWithUser = JobAssignment & { user: AssignedUser };

/** Response body of POST /api/job-assignments. */
export type AssignResponse = {
  message: string;
  assignment: JobAssignment;
};

/** Response body of DELETE /api/job-assignments/:id. */
export type UnassignResponse = {
  message: string;
};

/** "Rey Cruz": for an assigned recruiter or any account. */
export function fullName(person: {
  first_name: string;
  last_name: string;
}): string {
  return `${person.first_name} ${person.last_name}`;
}
