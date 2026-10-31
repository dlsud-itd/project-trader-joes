import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AiScreening, AiScreeningResponse } from './ai-screenings.models';

/** Calls /api/ai-screenings. Staff only. */
@Injectable({ providedIn: 'root' })
export class AiScreeningsService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/ai-screenings`;

  /** The saved screening. 404 when the application hasn't been screened. */
  get(applicationId: number): Observable<AiScreening> {
    return this.http.get<AiScreening>(`${this.api}/${applicationId}`);
  }

  /**
   * Scores the resume against its posting. A finished screening comes back
   * as is; pass `retry` to run a failed one again.
   */
  screen(applicationId: number, retry = false): Observable<AiScreening> {
    return this.http
      .post<AiScreeningResponse>(this.api, {
        application_id: applicationId,
        retry,
      })
      .pipe(map((res) => res.screening));
  }
}
