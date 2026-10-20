import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface HealthStatus {
  status: 'ok';
  database: 'up';
  time: string;
}

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);

  check(): Promise<HealthStatus> {
    return firstValueFrom(this.http.get<HealthStatus>(`${environment.apiUrl}/health`));
  }
}
