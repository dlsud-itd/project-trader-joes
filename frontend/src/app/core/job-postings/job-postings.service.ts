import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
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

  list(filter: { status?: JobPostingStatus; q?: string } = {}): Promise<JobPosting[]> {
    let params = new HttpParams();
    if (filter.status) params = params.set('status', filter.status);
    if (filter.q) params = params.set('q', filter.q);
    return firstValueFrom(this.http.get<JobPosting[]>(this.api, { params }));
  }

  get(id: number): Promise<JobPosting> {
    return firstValueFrom(this.http.get<JobPosting>(`${this.api}/${id}`));
  }

  create(body: JobPostingInput): Promise<JobPostingResponse> {
    return firstValueFrom(this.http.post<JobPostingResponse>(this.api, body));
  }

  update(id: number, body: Partial<JobPostingInput>): Promise<JobPostingResponse> {
    return firstValueFrom(this.http.patch<JobPostingResponse>(`${this.api}/${id}`, body));
  }

  setStatus(id: number, status: JobPostingStatus): Promise<JobPostingResponse> {
    return firstValueFrom(
      this.http.patch<JobPostingResponse>(`${this.api}/${id}/status`, { status }),
    );
  }
}
