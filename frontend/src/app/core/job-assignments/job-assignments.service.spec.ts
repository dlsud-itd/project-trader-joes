import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { JobAssignment, JobAssignmentWithUser } from './job-assignments.models';
import { JobAssignmentsService } from './job-assignments.service';

const ASSIGNMENTS_URL = `${environment.apiUrl}/job-assignments`;

const assignment: JobAssignment = {
  id: 10,
  job_posting_id: 1,
  user_id: 5,
  assigned_at: '2026-11-14T02:30:00Z',
};

const withUser: JobAssignmentWithUser = {
  ...assignment,
  user: {
    id: 5,
    first_name: 'Rey',
    last_name: 'Cruz',
    email: 'recruiter@talentflow.dev',
  },
};

describe('JobAssignmentsService', () => {
  let service: JobAssignmentsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(JobAssignmentsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists every assignment', () => {
    let result: JobAssignmentWithUser[] = [];
    service
      .list()
      .subscribe((list: JobAssignmentWithUser[]) => (result = list));

    const req = http.expectOne(ASSIGNMENTS_URL);
    expect(req.request.method).toBe('GET');
    req.flush([withUser]);

    expect(result).toEqual([withUser]);
  });

  it('assigns a recruiter and returns the new assignment', () => {
    let result: JobAssignment | undefined;
    service
      .assign(1, 5)
      .subscribe((created: JobAssignment) => (result = created));

    const req = http.expectOne(ASSIGNMENTS_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ job_posting_id: 1, user_id: 5 });
    req.flush({
      message: 'User assigned to job posting successfully.',
      assignment,
    });

    expect(result).toEqual(assignment);
  });

  it('removes an assignment', () => {
    let isDone = false;
    service.remove(10).subscribe(() => (isDone = true));

    const req = http.expectOne(`${ASSIGNMENTS_URL}/10`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'User removed from job posting.' });

    expect(isDone).toBe(true);
  });
});
