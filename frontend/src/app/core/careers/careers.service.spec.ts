import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { CareersService } from './careers.service';
import { PublicJobPosting } from './careers.models';

const API = environment.apiUrl;
const TOKEN = 'a'.repeat(64);

describe('CareersService', () => {
  let service: CareersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CareersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('always asks for open postings only', () => {
    let result: PublicJobPosting[] | undefined;
    service.listOpen().subscribe((list: PublicJobPosting[]) => {
      result = list;
    });
    const req = http.expectOne((r) => r.url === `${API}/job-postings`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('open');
    req.flush([]);
    expect(result).toEqual([]);
  });

  it('loads one posting by id', () => {
    service.get(7).subscribe();
    http.expectOne(`${API}/job-postings/7`).flush({});
  });

  it('posts the application as JSON', () => {
    const body = {
      job_posting_id: 7,
      full_name: 'Juan Dela Cruz',
      email: 'juan@example.com',
    };
    service.apply(body).subscribe();
    const req = http.expectOne(`${API}/applications`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('uploads the resume as multipart form data with the token', () => {
    const file = new File(['%PDF-1.7'], 'Juan CV.pdf', {
      type: 'application/pdf',
    });
    service.uploadResume(101, TOKEN, file).subscribe();

    const req = http.expectOne(`${API}/resumes`);
    expect(req.request.method).toBe('POST');
    const form = req.request.body as FormData;
    expect(form.get('application_id')).toBe('101');
    expect(form.get('upload_token')).toBe(TOKEN);
    expect((form.get('file') as File).name).toBe('Juan CV.pdf');
    req.flush({});
  });
});
