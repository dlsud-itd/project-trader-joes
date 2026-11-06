import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ApplicationRow, KanbanStage } from './applications.models';
import { ApplicationsService } from './applications.service';

const APPLICATIONS_URL = `${environment.apiUrl}/applications`;

const row: ApplicationRow = {
  id: 101,
  job_posting_id: 1,
  posting_title: 'Frontend Developer Intern',
  full_name: 'Mei-Lin Chen',
  email: 'meilin.chen@example.com',
  phone: null,
  portfolio_url: null,
  cover_note: null,
  kanban_stage: KanbanStage.SCREENING,
  submitted_at: '2026-10-21T02:10:00Z',
  resume: null,
  screening: null,
};

describe('ApplicationsService', () => {
  let service: ApplicationsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApplicationsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists every application', () => {
    let result: ApplicationRow[] = [];
    service.list().subscribe((list: ApplicationRow[]) => (result = list));

    const req = http.expectOne(APPLICATIONS_URL);
    expect(req.request.method).toBe('GET');
    req.flush([row]);

    expect(result).toEqual([row]);
  });

  it('loads one application by id', () => {
    let result: ApplicationRow | undefined;
    service.get(101).subscribe((one: ApplicationRow) => (result = one));

    http.expectOne(`${APPLICATIONS_URL}/101`).flush(row);

    expect(result).toEqual(row);
  });
});
