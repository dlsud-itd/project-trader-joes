import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApplicationRow } from './applications.models';

/** Calls GET /api/applications. Staff only on the API side. */
@Injectable({ providedIn: 'root' })
export class ApplicationsService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/applications`;

  /** Every application, newest first, with its AI screening. */
  list(): Observable<ApplicationRow[]> {
    return this.http.get<ApplicationRow[]>(this.api);
  }
}
