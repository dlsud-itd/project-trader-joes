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
import { Careers } from './careers';

const API = `${environment.apiUrl}/job-postings`;

const posting = (overrides: Partial<PublicJobPosting>): PublicJobPosting => ({
  id: 1,
  title: 'Software Developer',
  department: 'IT',
  location: 'Cavite',
  description: 'Develop and maintain software applications.',
  requirements: 'JavaScript\nSQL\nGit\nDocker\nAngular',
  status: JobPostingStatus.OPEN,
  created_at: '2026-10-23T00:00:00Z',
  ...overrides,
});

describe('Careers page', () => {
  let fixture: ComponentFixture<Careers>;
  let http: HttpTestingController;

  const text = () => fixture.nativeElement.textContent as string;
  const titles = () =>
    fixture.debugElement
      .queryAll(By.css('.card h2'))
      .map((el) => el.nativeElement.textContent.trim());

  async function render(list: PublicJobPosting[] | 'error') {
    TestBed.configureTestingModule({
      imports: [Careers],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    fixture = TestBed.createComponent(Careers);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    const req = http.expectOne((r) => r.url === API);
    // Always asks for open postings, even when staff are signed in.
    expect(req.request.params.get('status')).toBe('open');
    if (list === 'error') {
      req.flush(
        { error: 'Unable to retrieve job postings.' },
        { status: 500, statusText: 'Error' },
      );
    } else {
      req.flush(list);
    }
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('lists open roles with a link to each one', async () => {
    await render([
      posting({}),
      posting({ id: 2, title: 'HR Associate', department: 'HR' }),
    ]);

    expect(titles()).toEqual(['Software Developer', 'HR Associate']);
    expect(text()).toContain('2 open roles');
    const link = fixture.debugElement.query(By.css('a.card'))
      .nativeElement as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/careers/1');
  });

  it('shows three requirements and how many more there are', async () => {
    await render([posting({})]);
    const chips = fixture.debugElement
      .queryAll(By.css('.chips li'))
      .map((el) => el.nativeElement.textContent.trim());
    expect(chips).toEqual(['JavaScript', 'SQL', 'Git', '+2 more']);
  });

  it('filters by search text and by department', async () => {
    await render([
      posting({}),
      posting({
        id: 2,
        title: 'HR Associate',
        department: 'HR',
        location: 'Manila',
      }),
      posting({
        id: 3,
        title: 'QA Tester',
        department: 'IT',
        location: 'Manila',
      }),
    ]);

    const search = fixture.debugElement.query(
      By.css('input[type=search]'),
    ).nativeElement;
    search.value = 'manila';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(titles()).toEqual(['HR Associate', 'QA Tester']);

    const hr = fixture.debugElement
      .queryAll(By.css('.departments button'))
      .find((b) => b.nativeElement.textContent.trim() === 'HR')!;
    hr.nativeElement.click();
    fixture.detectChanges();
    expect(titles()).toEqual(['HR Associate']);
  });

  it('says when nothing matches and can clear the filters', async () => {
    await render([posting({})]);
    const search = fixture.debugElement.query(
      By.css('input[type=search]'),
    ).nativeElement;
    search.value = 'astronaut';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(text()).toContain('No roles match.');

    fixture.debugElement.query(By.css('.no-match .link')).nativeElement.click();
    fixture.detectChanges();
    expect(titles()).toEqual(['Software Developer']);
  });

  it('shows a friendly message when nothing is open', async () => {
    await render([]);
    expect(text()).toContain('No open roles right now');
  });

  it('shows the error and a retry button when loading fails', async () => {
    await render('error');
    expect(text()).toContain('Unable to retrieve job postings.');
    expect(text()).toContain('Try again');
  });
});
