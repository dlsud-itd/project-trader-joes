import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AiScreening,
  AiScreeningInput,
  AiScreeningResponse,
} from './ai-screenings.models';

/** Calls /api/ai-screenings. Staff only on the API side. */
@Injectable({ providedIn: 'root' })
export class AiScreeningsService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/ai-screenings`;

  /**
   * Screens the application's resume. A finished screening comes back as
   * it is; a failed one answers 409 until it is retried.
   */
  screen(applicationId: number): Observable<AiScreeningResponse> {
    const body: AiScreeningInput = { application_id: applicationId };
    return this.http.post<AiScreeningResponse>(this.api, body);
  }

  /** Retry analysis trigger: screens the resume again. */
  retry(applicationId: number): Observable<AiScreeningResponse> {
    const body: AiScreeningInput = {
      application_id: applicationId,
      retry: true,
    };
    return this.http.post<AiScreeningResponse>(this.api, body);
  }

  /** The saved screening; 404 when the resume was never screened. */
  get(applicationId: number): Observable<AiScreening> {
    return this.http.get<AiScreening>(`${this.api}/${applicationId}`);
  }
}
