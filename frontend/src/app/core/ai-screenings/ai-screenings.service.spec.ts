import {
  HttpErrorResponse,
  HttpStatusCode,
  provideHttpClient,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import {
  AiScreeningFailure,
  AiScreeningResponse,
  screeningFailure,
  ScreeningStatus,
} from './ai-screenings.models';
import { AiScreeningsService } from './ai-screenings.service';

const API = `${environment.apiUrl}/ai-screenings`;

const FAILURE: AiScreeningFailure = {
  error: 'AI screening could not be completed.',
  status: ScreeningStatus.FAILED,
  retry_count: 1,
  failure_reason: 'The AI service is busy right now. Try again later.',
};

describe('AiScreeningsService', () => {
  let service: AiScreeningsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AiScreeningsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('screens an application without asking for a retry', () => {
    let result: AiScreeningResponse | undefined;
    service.screen(101).subscribe((response: AiScreeningResponse) => {
      result = response;
    });

    const req = http.expectOne(API);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ application_id: 101 });
    req.flush({ message: 'AI screening processed successfully.' });
    expect(result?.message).toBe('AI screening processed successfully.');
  });

  it('retries a screening', () => {
    service.retry(101).subscribe();

    const req = http.expectOne(API);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ application_id: 101, retry: true });
    req.flush({});
  });

  it('loads the saved screening', () => {
    service.get(101).subscribe();

    const req = http.expectOne(`${API}/101`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('reports a failed screening with its reason', () => {
    let failure: AiScreeningFailure | null = null;
    service.screen(101).subscribe({
      error: (err: unknown) => {
        failure = screeningFailure(err);
      },
    });

    http.expectOne(API).flush(FAILURE, {
      status: HttpStatusCode.UnprocessableEntity,
      statusText: 'Unprocessable Entity',
    });
    expect(failure).toEqual(FAILURE);
  });
});

describe('screeningFailure', () => {
  it('ignores errors that are not a failed screening', () => {
    const notFound = new HttpErrorResponse({
      status: HttpStatusCode.NotFound,
      error: { error: 'Application not found.' },
    });
    expect(screeningFailure(notFound)).toBeNull();
    expect(screeningFailure(new Error('offline'))).toBeNull();
  });
});
