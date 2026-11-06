import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApplicationRow,
  KanbanStage,
  StageUpdate,
  StageUpdateResponse,
} from './applications.models';

/** Calls /api/applications. Listing and viewing are staff only. */
@Injectable({ providedIn: 'root' })
export class ApplicationsService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/applications`;

  /** Every application, newest first, with its AI screening. */
  list(): Observable<ApplicationRow[]> {
    return this.http.get<ApplicationRow[]>(this.api);
  }

  /** One application, for the profile page; 404 when it doesn't exist. */
  get(id: number): Observable<ApplicationRow> {
    return this.http.get<ApplicationRow>(`${this.api}/${id}`);
  }

  /** Moves an application to another pipeline stage. Managers only. */
  updateStage(id: number, kanban_stage: KanbanStage): Observable<StageUpdate> {
    return this.http
      .patch<StageUpdateResponse>(`${this.api}/${id}/stage`, { kanban_stage })
      .pipe(map((res: StageUpdateResponse) => res.application));
  }
}
