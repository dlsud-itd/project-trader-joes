import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { KanbanStage } from '../../core/applications';
import { User, UserRole } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { DashboardSummary, PostingMetrics } from '../../core/dashboard';
import { JobPostingStatus } from '../../core/job-postings';
import { Dashboard } from './dashboard';
import { POSTINGS_SHOWN } from './posting-breakdown';

const URL = `${environment.apiUrl}/dashboard`;

const MANAGER: User = {
  id: 1,
  email: 'manager@talentflow.dev',
  first_name: 'Maria',
  last_name: 'Santos',
  role: UserRole.MANAGER,
  created_at: '2026-10-01T00:00:00Z',
};
const RECRUITER: User = {
  ...MANAGER,
  id: 2,
  first_name: 'Juan',
  role: UserRole.RECRUITER,
};

const stages = (
  Applied: number,
  Screening: number,
  Interview: number,
  Offer: number,
  Rejected: number,
) => ({ Applied, Screening, Interview, Offer, Rejected });

const posting = (
  id: number,
  title: string,
  counts: ReturnType<typeof stages>,
  status = JobPostingStatus.OPEN,
): PostingMetrics => {
  const candidates = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    id,
    title,
    department: 'IT',
    status,
    candidates,
    active: candidates - counts.Rejected,
    stages: counts,
  };
};

const SUMMARY: DashboardSummary = {
  scope: 'all',
  postings: { open: 2, closed: 1, total: 3 },
  candidates: { total: 10, new_this_week: 4, awaiting_your_rating: 3 },
  stages: [
    { stage: KanbanStage.APPLIED, count: 4 },
    { stage: KanbanStage.SCREENING, count: 3 },
    { stage: KanbanStage.INTERVIEW, count: 1 },
    { stage: KanbanStage.OFFER, count: 0 },
    { stage: KanbanStage.REJECTED, count: 2 },
  ],
  by_posting: [
    posting(1, 'Frontend Developer Intern', stages(3, 2, 1, 0, 1)),
    posting(2, 'QA Analyst', stages(1, 1, 0, 0, 0)),
    posting(3, 'Old Role', stages(0, 0, 0, 0, 1), JobPostingStatus.CLOSED),
  ],
  generated_at: '2026-11-20T02:30:00Z',
};

describe('Dashboard', () => {
  let fixture: ComponentFixture<Dashboard>;
  let http: HttpTestingController;

  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => (el().textContent ?? '').replace(/\s+/g, ' ');
  const card = (id: string) =>
    el().querySelector<HTMLAnchorElement>(
      `.metric--${id}`,
    ) as HTMLAnchorElement;
  const value = (id: string) =>
    card(id).querySelector('.metric__value')?.textContent?.trim();
  const bar = (stage: string) =>
    el().querySelector<HTMLAnchorElement>(
      `.bar.tf-stage--${stage}`,
    ) as HTMLAnchorElement;
  /** The link as the router writes it into href. */
  const href = (a: Element | null) =>
    decodeURIComponent(a?.getAttribute('href') ?? '');

  function render(user: User = MANAGER) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: { user: signal(user) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
  }

  function answer(summary: DashboardSummary = SUMMARY) {
    http.expectOne(URL).flush(summary);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('shows the four totals', () => {
    render();
    answer();
    expect(value('postings')).toBe('2');
    expect(value('candidates')).toBe('10');
    expect(value('new')).toBe('4');
    expect(value('awaiting')).toBe('3');
    expect(text()).toContain('1 closed');
    expect(text()).toContain('8 still in the running');
    expect(text()).toContain('Across every job posting.');
  });

  it('links each total to the matching list', () => {
    render();
    answer();
    expect(href(card('postings'))).toBe('/postings');
    expect(href(card('candidates'))).toBe('/applications');
    expect(href(card('new'))).toBe('/applications?applied=7');
    expect(href(card('awaiting'))).toBe('/applications?review=unrated');
  });

  it('draws one bar per stage, linked to that stage', () => {
    render();
    answer();
    expect(el().querySelectorAll('.bar')).toHaveLength(5);
    expect(bar('Applied').textContent).toContain('4');
    expect(bar('Applied').textContent).toContain('40%');
    // The busiest stage fills its track.
    const fill = (stage: string) =>
      (bar(stage).querySelector('.bar__fill') as HTMLElement).style.width;
    expect(fill('Applied')).toBe('100%');
    expect(fill('Screening')).toBe('75%');
    expect(fill('Offer')).toBe('0%');
    expect(href(bar('Interview'))).toBe('/applications?stage=Interview');
    // Empty stages are left out of the stacked bar.
    expect(el().querySelectorAll('.stack__part')).toHaveLength(4);
  });

  it('lists postings with links to their applicants and stages', () => {
    render();
    answer();
    const titles = Array.from(el().querySelectorAll('.posting__title'));
    expect(titles.map((t) => t.textContent?.trim())).toEqual([
      'Frontend Developer Intern',
      'QA Analyst',
      'Old Role',
    ]);
    expect(href(titles[0])).toBe('/applications?posting=1');
    const firstParts = el()
      .querySelectorAll('.posting')[0]
      .querySelectorAll('.mini__part');
    expect(firstParts).toHaveLength(4); // no one in Offer
    expect(href(firstParts[0])).toBe('/applications?posting=1&stage=Applied');
    expect(firstParts[0].getAttribute('aria-label')).toBe(
      'Applied: 3 applicants',
    );
    expect(text()).toContain('Closed');
  });

  it('shows the first few postings, then all on request', () => {
    render();
    const many = Array.from({ length: POSTINGS_SHOWN + 2 }, (_, i) =>
      posting(i + 1, `Role ${i + 1}`, stages(1, 0, 0, 0, 0)),
    );
    answer({ ...SUMMARY, by_posting: many });
    expect(el().querySelectorAll('.posting')).toHaveLength(POSTINGS_SHOWN);

    const more = el().querySelector<HTMLButtonElement>('.more');
    expect(more?.textContent).toContain('Show 2 more');
    more?.click();
    fixture.detectChanges();
    expect(el().querySelectorAll('.posting')).toHaveLength(POSTINGS_SHOWN + 2);
    expect(el().querySelector('.more')?.textContent).toContain('Show fewer');
  });

  describe('recruiters', () => {
    const SCOPED: DashboardSummary = {
      ...SUMMARY,
      scope: 'assigned',
      postings: { open: 2, closed: 0, total: 2 },
      by_posting: SUMMARY.by_posting.slice(0, 2),
    };

    it('say whose postings the numbers cover', () => {
      render(RECRUITER);
      answer(SCOPED);
      expect(text()).toContain('For the 2 postings you’re assigned to.');
    });

    it('link to their own postings only', () => {
      render(RECRUITER);
      answer(SCOPED);
      expect(href(card('candidates'))).toBe('/applications?mine=1');
      expect(href(card('awaiting'))).toBe(
        '/applications?review=unrated&mine=1',
      );
      expect(href(bar('Offer'))).toBe('/applications?stage=Offer&mine=1');
    });

    it('get a friendly note when nothing is assigned yet', () => {
      render(RECRUITER);
      answer({
        ...SCOPED,
        postings: { open: 0, closed: 0, total: 0 },
        candidates: { total: 0, new_this_week: 0, awaiting_your_rating: 0 },
        stages: SUMMARY.stages.map((s) => ({ ...s, count: 0 })),
        by_posting: [],
      });
      expect(text()).toContain('No postings assigned yet');
      expect(el().querySelector('.metric')).toBeNull();
    });
  });

  it('shows placeholders while loading, then an error with a retry', () => {
    render();
    expect(el().querySelectorAll('.metric--skeleton')).toHaveLength(4);
    expect(text()).toContain('Loading your numbers');

    http.expectOne(URL).flush(
      { error: 'Database unavailable.' },
      {
        status: 503,
        statusText: 'Unavailable',
      },
    );
    fixture.detectChanges();
    expect(el().querySelector('[role=alert]')?.textContent).toContain(
      'Database unavailable.',
    );

    Array.from(el().querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.includes('Try again'))
      ?.click();
    answer();
    expect(el().querySelector('[role=alert]')).toBeNull();
    expect(value('candidates')).toBe('10');
  });

  it('refreshes on demand', () => {
    render();
    answer();
    el().querySelector<HTMLButtonElement>('.refresh')?.click();
    answer({ ...SUMMARY, candidates: { ...SUMMARY.candidates, total: 11 } });
    expect(value('candidates')).toBe('11');
  });

  it('explains when roleGuard sent the user here', () => {
    render();
    fixture.componentRef.setInput('denied', '1');
    answer();
    expect(text()).toContain('only available to recruitment managers');
  });
});
