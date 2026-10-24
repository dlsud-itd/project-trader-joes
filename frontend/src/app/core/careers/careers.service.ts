import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { JobPostingStatus } from '../job-postings';
import {
  ApplicationInput,
  ApplicationResponse,
  PublicJobPosting,
  ResumeResponse,
} from './careers.models';

/** Calls the public endpoints used by the careers page and the apply form. */
@Injectable({ providedIn: 'root' })
export class CareersService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /**
   * Open postings only. Asks for `status=open` explicitly so a signed-in
   * staff member browsing the careers page doesn't see closed ones.
   */
  listOpen(): Observable<PublicJobPosting[]> {
    const params = new HttpParams().set('status', JobPostingStatus.OPEN);
    return this.http.get<PublicJobPosting[]>(`${this.api}/job-postings`, {
      params,
    });
  }

  get(id: number): Observable<PublicJobPosting> {
    return this.http.get<PublicJobPosting>(`${this.api}/job-postings/${id}`);
  }

  apply(body: ApplicationInput): Observable<ApplicationResponse> {
    return this.http.post<ApplicationResponse>(
      `${this.api}/applications`,
      body,
    );
  }

  uploadResume(
    applicationId: number,
    uploadToken: string,
    file: File,
  ): Observable<ResumeResponse> {
    const form = new FormData();
    form.append('application_id', String(applicationId));
    form.append('upload_token', uploadToken);
    form.append('file', file, file.name);
    return this.http.post<ResumeResponse>(`${this.api}/resumes`, form);
  }
}
