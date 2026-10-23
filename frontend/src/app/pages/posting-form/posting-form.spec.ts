import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { JobPosting } from '../../core/job-postings/job-postings.models';
import { PostingForm } from './posting-form';

const API = `${environment.apiUrl}/job-postings`;

const existing: JobPosting = {
  id: 7,
  title: 'Software Developer',
  department: 'IT',
  location: 'Cavite',
  description: 'Develop and maintain software applications.',
  requirements: 'JavaScript\nSQL',
  status: 'open',
  created_by: 1,
  created_at: '2026-10-23T00:00:00Z',
  updated_at: '2026-10-23T00:00:00Z',
  author: { id: 1, first_name: 'Maria', last_name: 'Santos' },
};

describe('Posting form', () => {
  let fixture: ComponentFixture<PostingForm>;
  let page: PostingForm;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  const set = (id: string, value: string) => {
    const el = fixture.debugElement.query(By.css(`#${id}`)).nativeElement as HTMLInputElement;
    el.value = value;
    el.dispatchEvent(new Event('input'));
  };
  const submit = () => {
    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');
    fixture.detectChanges();
  };

  async function render(id?: string) {
    TestBed.configureTestingModule({
      imports: [PostingForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(PostingForm);
    page = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    if (id) fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
    http.expectOne(API).flush([existing]); // department suggestions
    if (id) http.expectOne(`${API}/${id}`).flush(existing);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('shows field errors and does not call the API when empty', async () => {
    await render();
    submit();
    const errors = fixture.debugElement.queryAll(By.css('.tf-error'));
    expect(errors.length).toBe(5);
  });

  it('creates a posting and returns to the list', async () => {
    await render();
    set('title', '  QA Tester ');
    set('department', 'IT');
    set('location', 'Makati');
    set('description', 'Plan and run manual and automated tests.');
    page['form'].controls.requirements.setValue('Test planning\nCypress');
    submit();

    const req = http.expectOne(API);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      title: 'QA Tester',
      department: 'IT',
      location: 'Makati',
      description: 'Plan and run manual and automated tests.',
      requirements: 'Test planning\nCypress',
      status: 'open',
    });
    req.flush({ message: 'ok', job_posting: { ...existing, id: 9 } });
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/postings'], {
      queryParams: { saved: 9, action: 'created' },
    });
  });

  it('updates the live preview as you type', async () => {
    await render();
    set('title', 'Data Analyst');
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.preview h2')).nativeElement.textContent).toContain(
      'Data Analyst',
    );
  });

  it('loads an existing posting and sends only the changed fields', async () => {
    await render('7');
    expect(
      (fixture.debugElement.query(By.css('#title')).nativeElement as HTMLInputElement).value,
    ).toBe('Software Developer');
    expect(page.hasUnsavedChanges()).toBe(false);

    set('location', 'Dasmariñas');
    expect(page.hasUnsavedChanges()).toBe(true);
    submit();

    const req = http.expectOne(`${API}/7`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ location: 'Dasmariñas' });
    req.flush({ message: 'ok', job_posting: existing });
    await fixture.whenStable();
    expect(page.hasUnsavedChanges()).toBe(false);
  });

  it('shows the API error when saving fails', async () => {
    await render('7');
    set('title', 'Senior Software Developer');
    submit();
    http
      .expectOne(`${API}/7`)
      .flush(
        { error: 'Your role does not have access to this action.' },
        { status: 403, statusText: 'Forbidden' },
      );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Your role does not have access to this action.',
    );
  });
});
