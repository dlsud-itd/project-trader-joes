import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { DashboardSummary, percent } from './dashboard.models';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  it('gets the summary from /api/dashboard', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const service = TestBed.inject(DashboardService);
    const http = TestBed.inject(HttpTestingController);

    let result: DashboardSummary | undefined;
    service.summary().subscribe((s: DashboardSummary) => (result = s));
    const req = http.expectOne(`${environment.apiUrl}/dashboard`);
    expect(req.request.method).toBe('GET');
    req.flush({ scope: 'all' });
    expect(result?.scope).toBe('all');
    http.verify();
  });
});

describe('percent', () => {
  it('rounds to a whole percent and handles an empty whole', () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
    expect(percent(5, 0)).toBe(0);
  });
});
