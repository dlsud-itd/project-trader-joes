import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RESUME_MIME_TYPE, ResumeSummary } from './resumes.models';

/** Calls /api/resumes. Downloading is staff only on the API side. */
@Injectable({ providedIn: 'root' })
export class ResumesService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/resumes`;

  /**
   * The resume file as a PDF blob, ready for an inline viewer.
   * Fetched through HttpClient so the auth interceptor adds the token.
   */
  getFile(resume: ResumeSummary): Observable<Blob> {
    return this.http
      .get(`${this.api}/${resume.id}/file`, { responseType: 'blob' })
      .pipe(map((file: Blob) => new Blob([file], { type: RESUME_MIME_TYPE })));
  }
}
