import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  JobPosting,
  JobPostingInput,
  JobPostingResponse,
  JobPostingStatus,
} from './job-postings.models';

/** Calls /api/job-postings. Writes are manager-only on the API side. */
@Injectable({ providedIn: 'root' })
export class JobPostingsService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/job-postings`;

  list(): Observable<JobPosting[]> {
    return this.http.get<JobPosting[]>(this.api);
  }

  get(id: number): Observable<JobPosting> {
    return this.http.get<JobPosting>(`${this.api}/${id}`);
  }

  create(body: JobPostingInput): Observable<JobPostingResponse> {
    return this.http.post<JobPostingResponse>(this.api, body);
  }

  update(
    id: number,
    body: Partial<JobPostingInput>,
  ): Observable<JobPostingResponse> {
    return this.http.patch<JobPostingResponse>(`${this.api}/${id}`, body);
  }

  setStatus(
    id: number,
    status: JobPostingStatus,
  ): Observable<JobPostingResponse> {
    return this.http.patch<JobPostingResponse>(`${this.api}/${id}/status`, {
      status,
    });
  }
}
