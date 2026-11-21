import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { ApplicantStatus, MyApplication } from '../../core/applications';
import { User, UserRole } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { MyApplications } from './my-applications';

const MINE_URL = `${environment.apiUrl}/applications/mine`;

const user: User = {
  id: 3,
  email: 'paula@example.com',
  first_name: 'Paula',
  last_name: 'Ng',
  role: UserRole.APPLICANT,
  created_at: '2026-11-01T00:00:00Z',
};

const application = (overrides: Partial<MyApplication>): MyApplication => ({
  id: 101,
  job_posting_id: 7,
  posting_title: 'Software Developer',
  submitted_at: '2026-10-21T12:00:00Z',
  status: ApplicantStatus.UNDER_REVIEW,
  ...overrides,
});

describe('My Applications page', () => {
  let fixture: ComponentFixture<MyApplications>;
  let http: HttpTestingController;

  const text = () => fixture.nativeElement.textContent as string;
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const reply = async (list: MyApplication[] | 'error') => {
    const req = http.expectOne(MINE_URL);
    if (list === 'error') {
      req.flush(
        { error: 'Unable to load applications.' },
        { status: 500, statusText: 'Error' },
      );
    } else {
      req.flush(list);
    }
    await settle();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MyApplications],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: { user: signal(user) } },
      ],
    });
    fixture = TestBed.createComponent(MyApplications);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('lists each application with a link, date, and status', async () => {
    await reply([
      application({}),
      application({
        id: 102,
        job_posting_id: 8,
        posting_title: 'HR Associate',
        status: ApplicantStatus.OFFER,
      }),
    ]);

    const titles = fixture.debugElement
      .queryAll(By.css('.card h2 a'))
      .map((el) => el.nativeElement as HTMLAnchorElement);
    expect(titles.map((a) => a.textContent?.trim())).toEqual([
      'Software Developer',
      'HR Associate',
    ]);
    expect(titles[0].getAttribute('href')).toBe('/careers/7');
    expect(text()).toContain('Applied Oct 21, 2026');

    const badges = fixture.debugElement
      .queryAll(By.css('.status'))
      .map((el) => el.nativeElement as HTMLElement);
    // The status is written out, not shown by color alone.
    expect(badges[0].textContent).toContain('Under review');
    expect(badges[0].classList).toContain('status--in-progress');
    expect(badges[1].textContent).toContain('Offer');
    expect(badges[1].classList).toContain('status--offer');
  });

  it('says which email the list is for', async () => {
    await reply([application({})]);

    expect(text()).toContain('Showing applications sent with');
    expect(text()).toContain('paula@example.com');
    expect(text()).toContain('different email');
  });

  it('shows the empty state with a link to open roles', async () => {
    await reply([]);

    expect(text()).toContain('You haven’t applied yet');
    const link = fixture.debugElement.query(By.css('.empty a'))
      .nativeElement as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/careers');
  });

  it('shows the error and loads again on Try again', async () => {
    await reply('error');

    expect(text()).toContain('Unable to load applications.');
    fixture.debugElement
      .query(By.css('.tf-alert button'))
      .triggerEventHandler('click');
    await reply([application({})]);

    expect(text()).not.toContain('Unable to load applications.');
    expect(text()).toContain('Software Developer');
  });
});
