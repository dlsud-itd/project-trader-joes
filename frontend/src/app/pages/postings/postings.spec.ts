import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { JobPosting, JobPostingStatus } from '../../core/job-postings';
import { Postings } from './postings';

const API = `${environment.apiUrl}/job-postings`;

const posting = (overrides: Partial<JobPosting>): JobPosting => ({
  id: 1,
  title: 'Software Developer',
  department: 'IT',
  location: 'Cavite',
  description: 'Develop and maintain software applications.',
  requirements: 'JavaScript\nSQL\nGit\nDocker\nAngular\nNestJS',
  status: JobPostingStatus.OPEN,
  created_by: 1,
  created_at: '2026-10-23T00:00:00Z',
  updated_at: '2026-10-23T00:00:00Z',
  author: { id: 1, first_name: 'Maria', last_name: 'Santos' },
  ...overrides,
});

describe('Postings page', () => {
  let fixture: ComponentFixture<Postings>;
  let http: HttpTestingController;
  let isManager = true;

  const text = () => fixture.nativeElement.textContent as string;
  const titles = () =>
    fixture.debugElement
      .queryAll(By.css('.item__title h2'))
      .map((el) => el.nativeElement.textContent.trim());

  async function render(list: JobPosting[]) {
    TestBed.configureTestingModule({
      imports: [Postings],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: { hasRole: () => isManager } },
      ],
    });
    fixture = TestBed.createComponent(Postings);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(API).flush(list);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    isManager = true;
    HTMLDialogElement.prototype.showModal ??= function (
      this: HTMLDialogElement,
    ) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.open = false;
    };
  });

  afterEach(() => http.verify());

  it('lists postings with status counts and requirements', async () => {
    await render([
      posting({}),
      posting({
        id: 2,
        title: 'HR Associate',
        status: JobPostingStatus.CLOSED,
      }),
    ]);
    expect(titles()).toEqual(['Software Developer', 'HR Associate']);
    expect(text()).toContain('+2 more');
    const counts = fixture.debugElement
      .queryAll(By.css('.tabs__count'))
      .map((el) => el.nativeElement.textContent.trim());
    expect(counts).toEqual(['2', '1', '1']);
  });

  it('filters by status', async () => {
    await render([
      posting({}),
      posting({
        id: 2,
        title: 'HR Associate',
        status: JobPostingStatus.CLOSED,
      }),
    ]);
    fixture.debugElement
      .queryAll(By.css('.tabs button'))[2]
      .nativeElement.click();
    fixture.detectChanges();
    expect(titles()).toEqual(['HR Associate']);
  });

  it('asks before closing, then updates the posting', async () => {
    await render([posting({})]);
    fixture.debugElement.query(By.css('.tf-switch')).nativeElement.click();
    fixture.detectChanges();
    expect(text()).toContain('Close “Software Developer”?');

    fixture.debugElement.query(By.css('.confirm__close')).nativeElement.click();
    const req = http.expectOne(`${API}/1/status`);
    expect(req.request.body).toEqual({ status: JobPostingStatus.CLOSED });
    req.flush({
      message: 'ok',
      job_posting: posting({ status: JobPostingStatus.CLOSED }),
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.css('.tf-switch')).attributes[
        'aria-checked'
      ],
    ).toBe('false');
    expect(text()).toContain('no longer accepts applications');
  });

  it('reopens without asking', async () => {
    await render([posting({ status: JobPostingStatus.CLOSED })]);
    fixture.debugElement.query(By.css('.tf-switch')).nativeElement.click();
    http.expectOne(`${API}/1/status`).flush({
      message: 'ok',
      job_posting: posting({ status: JobPostingStatus.OPEN }),
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      fixture.debugElement.query(By.css('.tf-switch')).attributes[
        'aria-checked'
      ],
    ).toBe('true');
  });

  it('hides management controls from recruiters', async () => {
    isManager = false;
    await render([posting({})]);
    expect(fixture.debugElement.query(By.css('.tf-switch'))).toBeNull();
    expect(text()).not.toContain('New posting');
  });
});
