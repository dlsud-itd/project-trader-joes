import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { formatFileSize } from '../../shared/resume-viewer';
import { ApplicantProfile, displayUrl } from './applicant-profile';

/** Sample applicant with a resume on file. */
const WITH_RESUME = '101';
/** Sample applicant whose resume upload never finished. */
const WITHOUT_RESUME = '105';

describe('Applicant profile page', () => {
  let fixture: ComponentFixture<ApplicantProfile>;
  let http: HttpTestingController;

  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';

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
    // The resume request stays open until a test flushes it.
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('shows the applicant, contact details and cover note', async () => {
    render(WITH_RESUME);
    http.expectOne('/sample-resumes/101.pdf').flush(new Blob(['%PDF']));

    expect(el().querySelector('h1')?.textContent).toContain('Mei-Lin Chen');
    expect(text()).toContain('Frontend Developer Intern');
    expect(text()).toContain('+63 917 555 0101');
    expect(text()).toContain('meilin.dev');
    expect(text()).toContain('I have shipped Angular features');
  });

  it('shows the resume in an inline viewer once it loads', async () => {
    render(WITH_RESUME);
    expect(el().querySelector('.loading')).not.toBeNull();

    http.expectOne('/sample-resumes/101.pdf').flush(new Blob(['%PDF']));
    await fixture.whenStable();
    fixture.detectChanges();

    const frame = el().querySelector('iframe');
    expect(frame?.getAttribute('src')).toMatch(/^blob:/);
    expect(frame?.title).toBe('Resume of Mei-Lin Chen');
    expect(text()).toContain('Mei-Lin-Chen-Resume.pdf');
    expect(text()).toContain('Download');
  });

  it('offers a retry when the resume fails to load', async () => {
    render(WITH_RESUME);
    http
      .expectOne('/sample-resumes/101.pdf')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text()).toContain('Could not load the resume.');
    const retry = Array.from(el().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Try again'),
    );
    retry?.click();
    fixture.detectChanges();
    http.expectOne('/sample-resumes/101.pdf').flush(new Blob(['%PDF']));
  });

  it('says so when no resume was uploaded', async () => {
    render(WITHOUT_RESUME);

    expect(text()).toContain('No resume uploaded');
    expect(el().querySelector('iframe')).toBeNull();
  });

  it('shows a not-found message for an unknown id', async () => {
    render('9999');

    expect(text()).toContain('Applicant not found');
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
