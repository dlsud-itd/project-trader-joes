import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { ApplicationRow } from '../../core/applications';
import { formatFileSize } from '../../shared/resume-viewer';
import { TEST_APPLICATIONS } from '../applications/test-applications';
import { ApplicantProfile, displayUrl } from './applicant-profile';

const API = environment.apiUrl;

/** Applicant with a resume on file. */
const WITH_RESUME = '101';
/** Applicant whose resume upload never finished. */
const WITHOUT_RESUME = '105';

const byId = (id: string) =>
  TEST_APPLICATIONS.find((r) => r.id === Number(id)) as ApplicationRow;

describe('Applicant profile page', () => {
  let fixture: ComponentFixture<ApplicantProfile>;
  let http: HttpTestingController;

  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';
  const button = (label: string) =>
    Array.from(el().querySelectorAll('button')).find((b) =>
      b.textContent?.includes(label),
    );

  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  /** Opens the page; the application request stays open for the test. */
  function render(id: string) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ApplicantProfile);
    fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
  }

  /**
   * Opens the page and answers the application request. Only re-renders:
   * waiting for the page to settle would hang on the open resume request.
   */
  function renderLoaded(id: string) {
    render(id);
    http
      .expectOne(`${API}/applications/${id}`)
      .flush(structuredClone(byId(id)));
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('loads the applicant from the API', async () => {
    render(WITH_RESUME);
    expect(text()).toContain('Loading applicant…');

    http
      .expectOne(`${API}/applications/${WITH_RESUME}`)
      .flush(byId(WITH_RESUME));
    fixture.detectChanges();
    http.expectOne(`${API}/resumes/101/file`).flush(new Blob(['%PDF']));

    expect(el().querySelector('h1')?.textContent).toContain('Mei-Lin Chen');
    expect(text()).toContain('Frontend Developer Intern');
    expect(text()).toContain('+63 917 555 0101');
    expect(text()).toContain('meilin.dev');
    expect(text()).toContain('I have shipped Angular features');
  });

  it('shows the resume in an inline viewer once it loads', async () => {
    renderLoaded(WITH_RESUME);
    expect(el().querySelector('.loading')).not.toBeNull();

    http.expectOne(`${API}/resumes/101/file`).flush(new Blob(['%PDF']));
    await settle();

    const frame = el().querySelector('iframe');
    expect(frame?.getAttribute('src')).toMatch(/^blob:/);
    expect(frame?.title).toBe('Resume of Mei-Lin Chen');
    expect(text()).toContain('Mei-Lin-Chen-Resume.pdf');
    expect(text()).toContain('Download');
  });

  it('offers a retry when the resume fails to load', async () => {
    renderLoaded(WITH_RESUME);
    http
      .expectOne(`${API}/resumes/101/file`)
      .flush(null, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(text()).toContain('Could not load the resume.');
    button('Try again')?.click();
    fixture.detectChanges();
    http.expectOne(`${API}/resumes/101/file`).flush(new Blob(['%PDF']));
  });

  it('says so when no resume was uploaded, and does not score it', async () => {
    renderLoaded(WITHOUT_RESUME);

    expect(text()).toContain('No resume uploaded');
    expect(el().querySelector('iframe')).toBeNull();

    button('Score resume')?.click();
    fixture.detectChanges();
    http.expectNone(`${API}/ai-screenings`);
    expect(text()).toContain('has not uploaded a resume yet');
  });

  it('re-scores the resume through the AI screening API', async () => {
    renderLoaded(WITH_RESUME);
    http.expectOne(`${API}/resumes/101/file`).flush(new Blob(['%PDF']));
    await settle();

    button('Re-score')?.click();
    fixture.detectChanges();
    const req = http.expectOne(`${API}/ai-screenings`);
    expect(req.request.body).toEqual({ application_id: 101, retry: true });
    req.flush({
      message: 'ok',
      screening: { ...byId(WITH_RESUME).screening!, fit_score: 95 },
    });
    await settle();

    expect(el().querySelector('app-fit-score-card')?.textContent).toContain(
      '95',
    );
  });

  it('shows a not-found message for an unknown id', async () => {
    render('9999');
    http
      .expectOne(`${API}/applications/9999`)
      .flush(
        { error: 'Application not found.' },
        { status: 404, statusText: 'Not Found' },
      );
    await settle();

    expect(text()).toContain('Applicant not found');
  });

  it('shows other load errors with a retry', async () => {
    render(WITH_RESUME);
    http
      .expectOne(`${API}/applications/${WITH_RESUME}`)
      .flush(
        { error: 'Something broke.' },
        { status: 500, statusText: 'Server Error' },
      );
    await settle();
    expect(text()).toContain('Something broke.');

    button('Try again')?.click();
    http
      .expectOne(`${API}/applications/${WITH_RESUME}`)
      .flush(byId(WITH_RESUME));
    fixture.detectChanges();
    http.expectOne(`${API}/resumes/101/file`).flush(new Blob(['%PDF']));
    expect(el().querySelector('h1')?.textContent).toContain('Mei-Lin Chen');
  });
});

describe('displayUrl', () => {
  it('drops the scheme and trailing slash', () => {
    expect(displayUrl('https://meilin.dev/')).toBe('meilin.dev');
    expect(displayUrl('http://github.com/kenjiw')).toBe('github.com/kenjiw');
  });
});

describe('formatFileSize', () => {
  it('shows KB under a megabyte, MB above', () => {
    expect(formatFileSize(2331)).toBe('2 KB');
    expect(formatFileSize(300)).toBe('1 KB');
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });
});
