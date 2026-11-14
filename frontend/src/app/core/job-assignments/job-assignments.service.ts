import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AssignResponse,
  JobAssignment,
  JobAssignmentWithUser,
  UnassignResponse,
} from './job-assignments.models';

/**
 * Calls /api/job-assignments. Staff can list; only managers assign or
 * remove.
 */
@Injectable({ providedIn: 'root' })
export class JobAssignmentsService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/job-assignments`;

  /** Every assignment, with the recruiter's name. */
  list(): Observable<JobAssignmentWithUser[]> {
    return this.http.get<JobAssignmentWithUser[]>(this.api);
  }

  /** Assigns a recruiter to a posting; 409 when already assigned. */
  assign(job_posting_id: number, user_id: number): Observable<JobAssignment> {
    return this.http
      .post<AssignResponse>(this.api, { job_posting_id, user_id })
      .pipe(map((res: AssignResponse) => res.assignment));
  }

  /** Takes a recruiter off a posting. */
  remove(id: number): Observable<void> {
    return this.http
      .delete<UnassignResponse>(`${this.api}/${id}`)
      .pipe(map(() => undefined));
  }
}
