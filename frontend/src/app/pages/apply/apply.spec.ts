import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { PublicJobPosting } from '../../core/careers';
import { JobPostingStatus } from '../../core/job-postings';
import { Apply } from './apply';

const API = environment.apiUrl;
const TOKEN = 'a'.repeat(64);

const posting: PublicJobPosting = {
  id: 7,
  title: 'Software Developer',
  department: 'IT',
  location: 'Cavite',
  description: 'Develop and maintain software applications.',
  requirements: 'JavaScript\nSQL',
  status: JobPostingStatus.OPEN,
  created_at: '2026-10-23T00:00:00Z',
};

const resume = new File([new Uint8Array(1000)], 'Juan CV.pdf', {
  type: 'application/pdf',
});

describe('Apply page', () => {
  let fixture: ComponentFixture<Apply>;
  let http: HttpTestingController;

  const text = () => fixture.nativeElement.textContent as string;
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const type = (id: string, value: string) => {
    const input = fixture.debugElement.query(By.css(`#${id}`)).nativeElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const chooseResume = () => {
    const input = fixture.debugElement.query(
      By.css('input[type=file]'),
    ).nativeElement;
    Object.defineProperty(input, 'files', {
      value: [resume],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
  };
  const submit = async () => {
    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');
    fixture.detectChanges();
  };
  const fillRequired = () => {
    type('full_name', 'Juan Dela Cruz');
    type('email', 'juan@example.com');
    chooseResume();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Apply],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    fixture = TestBed.createComponent(Apply);
    fixture.componentRef.setInput('id', '7');
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`${API}/job-postings/7`).flush(posting);
    await settle();
  });

  afterEach(() => http.verify());

  it('shows the role being applied for', () => {
    expect(text()).toContain('Apply for Software Developer');
  });

  it('sends nothing until the required fields are filled in', async () => {
    await submit();
    expect(text()).toContain('Enter your full name.');
    expect(text()).toContain('Enter a valid email address.');
    expect(text()).toContain('Attach your resume.');
    http.expectNone(`${API}/applications`);
  });

  it('checks optional fields only when they are filled in', async () => {
    fillRequired();
    type('phone', 'call me');
    type('portfolio_url', 'github.com/juan');
    await submit();
    expect(text()).toContain('Enter a valid phone number');
    expect(text()).toContain('Enter a full link starting with https://.');
    http.expectNone(`${API}/applications`);
  });

  it('sends the application, then the resume, then says thanks', async () => {
    fillRequired();
    type('portfolio_url', 'https://github.com/juan');
    await submit();

    const apply = http.expectOne(`${API}/applications`);
    // Skipped optional fields are left out.
    expect(apply.request.body).toEqual({
      job_posting_id: 7,
      full_name: 'Juan Dela Cruz',
      email: 'juan@example.com',
      portfolio_url: 'https://github.com/juan',
    });
    expect(text()).toContain('Sending application…');
    apply.flush({
      message: 'Application submitted successfully.',
      application: {
        id: 101,
        job_posting_id: 7,
        kanban_stage: 'Applied',
        submitted_at: '',
      },
      upload_token: TOKEN,
    });
    await settle();

    const upload = http.expectOne(`${API}/resumes`);
    const form = upload.request.body as FormData;
    expect(form.get('application_id')).toBe('101');
    expect(form.get('upload_token')).toBe(TOKEN);
    expect((form.get('file') as File).name).toBe('Juan CV.pdf');
    upload.flush({ message: 'Resume uploaded successfully.', resume: {} });
    await settle();

    expect(text()).toContain('Application sent');
    expect(text()).toContain('juan@example.com');
  });

  it('shows the API error when the application is refused', async () => {
    fillRequired();
    await submit();
    http.expectOne(`${API}/applications`).flush(
      {
        error: 'You have already applied for this position with this email.',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await settle();
    expect(text()).toContain(
      'You have already applied for this position with this email.',
    );
    expect(text()).toContain('Submit application');
  });

  it('resends only the resume when the upload fails', async () => {
    fillRequired();
    await submit();
    http.expectOne(`${API}/applications`).flush({
      message: 'Application submitted successfully.',
      application: {
        id: 101,
        job_posting_id: 7,
        kanban_stage: 'Applied',
        submitted_at: '',
      },
      upload_token: TOKEN,
    });
    await settle();
    http
      .expectOne(`${API}/resumes`)
      .flush(
        { error: 'Upload a PDF file.' },
        { status: 400, statusText: 'Bad' },
      );
    await settle();

    expect(text()).toContain('Only the resume needs to be sent again.');
    const retry = fixture.debugElement
      .queryAll(By.css('button'))
      .find((b) => b.nativeElement.textContent.includes('Send resume again'))!;
    retry.nativeElement.click();
    fixture.detectChanges();

    // Only the resume is sent again, with the same application.
    http.expectNone(`${API}/applications`);
    http
      .expectOne(`${API}/resumes`)
      .flush({ message: 'Resume uploaded successfully.', resume: {} });
    await settle();
    expect(text()).toContain('Application sent');
  });
});

describe('Apply page for a closed role', () => {
  it('says the role is no longer accepting applications', async () => {
    TestBed.configureTestingModule({
      imports: [Apply],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    const fixture = TestBed.createComponent(Apply);
    fixture.componentRef.setInput('id', '7');
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http
      .expectOne(`${API}/job-postings/7`)
      .flush(
        { error: 'Job posting not found.' },
        { status: 404, statusText: 'Not Found' },
      );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'no longer accepting applications',
    );
    expect(fixture.debugElement.query(By.css('form'))).toBeNull();
    http.verify();
  });
});
