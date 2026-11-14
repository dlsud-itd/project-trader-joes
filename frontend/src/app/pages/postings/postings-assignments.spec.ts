import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { User, UserRole } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { fullName, JobAssignmentWithUser } from '../../core/job-assignments';
import { JobPosting, JobPostingStatus } from '../../core/job-postings';
import { Postings } from './postings';

const POSTINGS_API = `${environment.apiUrl}/job-postings`;
const ASSIGNMENTS_API = `${environment.apiUrl}/job-assignments`;
const USERS_API = `${environment.apiUrl}/users`;

const staff = (
  id: number,
  first_name: string,
  last_name: string,
  role: UserRole,
): User => ({
  id,
  first_name,
  last_name,
  role,
  email: `${first_name.toLowerCase()}@talentflow.dev`,
  created_at: '2026-10-16T00:00:00Z',
});

const REY = staff(5, 'Rey', 'Cruz', UserRole.RECRUITER);
const ANA = staff(6, 'Ana', 'Lim', UserRole.RECRUITER);
const MARIA = staff(1, 'Maria', 'Santos', UserRole.MANAGER);

const POSTING: JobPosting = {
  id: 1,
  title: 'QA Analyst',
  department: 'IT',
  location: 'Cavite',
  description: 'Test the TalentFlow apps.',
  requirements: 'Testing',
  status: JobPostingStatus.OPEN,
  created_by: MARIA.id,
  created_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-11-01T00:00:00Z',
  author: { id: MARIA.id, first_name: 'Maria', last_name: 'Santos' },
};

const assigned = (id: number, user: User): JobAssignmentWithUser => ({
  id,
  job_posting_id: POSTING.id,
  user_id: user.id,
  assigned_at: '2026-11-14T00:00:00Z',
  user: {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
  },
});

describe('Postings page: recruiter assignments', () => {
  let fixture: ComponentFixture<Postings>;
  let http: HttpTestingController;

  const el = () => fixture.nativeElement as HTMLElement;
  const people = (): (string | undefined)[] =>
    Array.from(el().querySelectorAll('.person')).map((p: Element) =>
      p.firstChild?.textContent?.trim(),
    );
  const picker = (): HTMLSelectElement | null =>
    el().querySelector<HTMLSelectElement>('.team__add select');
  const assignButton = (): HTMLButtonElement =>
    el().querySelector<HTMLButtonElement>(
      '.team__add button',
    ) as HTMLButtonElement;
  const removeButton = (name: string): HTMLButtonElement =>
    el().querySelector<HTMLButtonElement>(
      `.person__remove[aria-label="Remove ${name} from QA Analyst"]`,
    ) as HTMLButtonElement;

  async function render(
    user: User,
    assignments: JobAssignmentWithUser[],
  ): Promise<void> {
    const isManager = user.role === UserRole.MANAGER;
    TestBed.configureTestingModule({
      imports: [Postings],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { hasRole: () => isManager, user: () => user },
        },
      ],
    });
    fixture = TestBed.createComponent(Postings);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(POSTINGS_API).flush([POSTING]);
    http.expectOne(ASSIGNMENTS_API).flush(assignments);
    if (isManager) http.expectOne(USERS_API).flush([MARIA, REY, ANA]);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Picks a recruiter in the posting's picker and clicks Assign. */
  function pickAndAssign(user: User): void {
    const select = picker() as HTMLSelectElement;
    const option = Array.from(select.options).find(
      (o: HTMLOptionElement) => o.textContent?.trim() === fullName(user),
    ) as HTMLOptionElement;
    select.value = option.value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    assignButton().click();
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('shows the recruiters assigned to each posting', async () => {
    await render(MARIA, [assigned(10, REY)]);
    expect(people()).toEqual(['Rey Cruz']);
  });

  it('says so when no one is assigned yet', async () => {
    await render(MARIA, []);
    expect(el().querySelector('.team__none')?.textContent).toContain(
      'No recruiters assigned',
    );
  });

  it('offers managers only recruiters who are not assigned yet', async () => {
    await render(MARIA, [assigned(10, REY)]);
    const options = Array.from((picker() as HTMLSelectElement).options).map(
      (o: HTMLOptionElement) => o.textContent?.trim(),
    );
    expect(options).toEqual(['Add recruiter…', 'Ana Lim']);
    expect(assignButton().disabled).toBe(true);
  });

  it('assigns a recruiter and shows them on the posting', async () => {
    await render(MARIA, []);
    pickAndAssign(ANA);

    const req = http.expectOne(ASSIGNMENTS_API);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      job_posting_id: POSTING.id,
      user_id: ANA.id,
    });
    req.flush({
      message: 'User assigned to job posting successfully.',
      assignment: {
        id: 11,
        job_posting_id: POSTING.id,
        user_id: ANA.id,
        assigned_at: '2026-11-14T03:00:00Z',
      },
    });
    fixture.detectChanges();

    expect(people()).toEqual(['Ana Lim']);
    const message = 'Ana Lim was assigned to “QA Analyst”.';
    expect(el().textContent).toContain(message);
  });

  it('shows the reason when assigning fails', async () => {
    await render(MARIA, []);
    pickAndAssign(REY);

    http
      .expectOne(ASSIGNMENTS_API)
      .flush(
        { error: 'User is already assigned to this job posting.' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    expect(people()).toEqual([]);
    expect(el().querySelector('.tf-alert--error')?.textContent).toContain(
      'User is already assigned to this job posting.',
    );
  });

  it('removes a recruiter from the posting', async () => {
    await render(MARIA, [assigned(10, REY)]);
    removeButton('Rey Cruz').click();
    fixture.detectChanges();

    const req = http.expectOne(`${ASSIGNMENTS_API}/10`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'User removed from job posting.' });
    fixture.detectChanges();

    expect(people()).toEqual([]);
    expect(el().textContent).toContain(
      'Rey Cruz was removed from “QA Analyst”.',
    );
  });

  it('shows recruiters their own assignment, read-only', async () => {
    await render(REY, [assigned(10, REY), assigned(11, ANA)]);
    expect(people()).toEqual(['Rey Cruz', 'Ana Lim']);
    expect(el().querySelector('.person.is-you')?.textContent).toContain('You');
    expect(picker()).toBeNull();
    expect(el().querySelector('.person__remove')).toBeNull();
  });
});
