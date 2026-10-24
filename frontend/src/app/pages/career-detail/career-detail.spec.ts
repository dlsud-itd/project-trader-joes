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
import { CareerDetail } from './career-detail';

const API = `${environment.apiUrl}/job-postings`;

const posting: PublicJobPosting = {
  id: 7,
  title: 'Software Developer',
  department: 'IT',
  location: 'Cavite',
  description: 'Develop and maintain software applications.',
  requirements: 'JavaScript\nSQL\nGit',
  status: JobPostingStatus.OPEN,
  created_at: '2026-10-23T00:00:00Z',
};

describe('Career detail page', () => {
  let fixture: ComponentFixture<CareerDetail>;
  let http: HttpTestingController;

  const text = () => fixture.nativeElement.textContent as string;

  async function render(
    respond: (req: ReturnType<HttpTestingController['expectOne']>) => void,
  ) {
    TestBed.configureTestingModule({
      imports: [CareerDetail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    fixture = TestBed.createComponent(CareerDetail);
    fixture.componentRef.setInput('id', '7');
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    respond(http.expectOne(`${API}/7`));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('shows the role, its requirements, and an Apply link', async () => {
    await render((req) => req.flush(posting));

    expect(text()).toContain('Software Developer');
    expect(text()).toContain('Develop and maintain software applications.');
    const reqs = fixture.debugElement
      .queryAll(By.css('.requirements li'))
      .map((el) => el.nativeElement.textContent.trim());
    expect(reqs).toEqual(['JavaScript', 'SQL', 'Git']);

    const apply = fixture.debugElement.query(By.css('.apply a'))
      .nativeElement as HTMLAnchorElement;
    expect(apply.getAttribute('href')).toBe('/careers/7/apply');
  });

  it('says the role is unavailable when the API returns 404', async () => {
    await render((req) =>
      req.flush(
        { error: 'Job posting not found.' },
        { status: 404, statusText: 'Not Found' },
      ),
    );
    expect(text()).toContain('This role is no longer available');
    expect(fixture.debugElement.query(By.css('.apply'))).toBeNull();
  });

  it('treats a closed posting (seen by staff) as unavailable', async () => {
    await render((req) =>
      req.flush({ ...posting, status: JobPostingStatus.CLOSED }),
    );
    expect(text()).toContain('This role is no longer available');
  });
});
