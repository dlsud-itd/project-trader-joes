import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import {
  AiScreening,
  clampScore,
  countMatches,
  fitTier,
} from './ai-screenings.models';
import { AiScreeningsService } from './ai-screenings.service';

const API = environment.apiUrl;

describe('fitTier', () => {
  it('uses the mockup bands: 80+ strong, 60–79 possible, under 60 weak', () => {
    expect(fitTier(100)).toBe('strong');
    expect(fitTier(80)).toBe('strong');
    expect(fitTier(79)).toBe('possible');
    expect(fitTier(60)).toBe('possible');
    expect(fitTier(59)).toBe('weak');
    expect(fitTier(0)).toBe('weak');
  });
});

describe('clampScore', () => {
  it('keeps scores whole and inside 0–100', () => {
    expect(clampScore(87.4)).toBe(87);
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(140)).toBe(100);
    expect(clampScore(Number.NaN)).toBe(0);
  });
});

describe('countMatches', () => {
  it('counts each match level', () => {
    expect(
      countMatches([
        { requirement: 'A', match: 'met', evidence: '' },
        { requirement: 'B', match: 'met', evidence: '' },
        { requirement: 'C', match: 'partial', evidence: '' },
        { requirement: 'D', match: 'missing', evidence: '' },
      ]),
    ).toEqual({ met: 2, partial: 1, missing: 1, total: 4 });
  });

  it('treats a missing list as empty', () => {
    expect(countMatches(null)).toEqual({
      met: 0,
      partial: 0,
      missing: 0,
      total: 0,
    });
  });
});

describe('AiScreeningsService', () => {
  let service: AiScreeningsService;
  let http: HttpTestingController;

  const screening = { id: 1, application_id: 7 } as AiScreening;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AiScreeningsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the saved screening for an application', () => {
    let result: AiScreening | undefined;
    service.get(7).subscribe((s) => (result = s));
    const req = http.expectOne(`${API}/ai-screenings/7`);
    expect(req.request.method).toBe('GET');
    req.flush(screening);
    expect(result).toEqual(screening);
  });

  it('screens an application and unwraps the response', () => {
    let result: AiScreening | undefined;
    service.screen(7).subscribe((s) => (result = s));
    const req = http.expectOne(`${API}/ai-screenings`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ application_id: 7, retry: false });
    req.flush({ message: 'ok', screening });
    expect(result).toEqual(screening);
  });

  it('sends retry when asked', () => {
    service.screen(7, true).subscribe();
    const req = http.expectOne(`${API}/ai-screenings`);
    expect(req.request.body).toEqual({ application_id: 7, retry: true });
    req.flush({ message: 'ok', screening });
  });
});
