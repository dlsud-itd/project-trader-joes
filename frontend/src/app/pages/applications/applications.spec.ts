import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import {
  AiScreening,
  FitTier,
  ScreeningStatus,
} from '../../core/ai-screenings';
import { ApplicationRow } from '../../core/applications';
import { Applications, fitGroup } from './applications';
import { TEST_APPLICATIONS } from './test-applications';

const LIST_URL = `${environment.apiUrl}/applications`;
const SCREEN_URL = `${environment.apiUrl}/ai-screenings`;

const byName = (name: string) =>
  TEST_APPLICATIONS.find((r) => r.full_name === name) as ApplicationRow;

/** Hana is the one applicant not screened yet; here she has a resume too. */
const WITH_HANA_RESUME: ApplicationRow[] = TEST_APPLICATIONS.map((r) =>
  r.full_name === 'Hana Kim'
    ? {
        ...r,
        resume: {
          id: 105,
          file_name: 'Hana-Kim.pdf',
          size_bytes: 2048,
          uploaded_at: r.submitted_at,
        },
      }
    : r,
);

describe('fitGroup', () => {
  it('groups by fit tier, and unscored when there is no score', () => {
    expect(fitGroup(byName('Mei-Lin Chen'))).toBe(FitTier.STRONG);
    expect(fitGroup(byName('Aisha Rahman'))).toBe(FitTier.POSSIBLE);
    expect(fitGroup(byName('Daniel Okafor'))).toBe(FitTier.WEAK);
    expect(fitGroup(byName('Lucas Martin'))).toBe('unscored'); // failed
    expect(fitGroup(byName('Hana Kim'))).toBe('unscored'); // not screened
  });
});

describe('Applications', () => {
  let fixture: ComponentFixture<Applications>;
  let http: HttpTestingController;

  const el = () => fixture.nativeElement as HTMLElement;
  const names = () =>
    Array.from(el().querySelectorAll('.who__name')).map((n) =>
      n.textContent?.trim(),
    );
  const chip = (label: string) =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('.chip')).find((c) =>
      c.textContent?.includes(label),
    );
  const detailName = () => el().querySelector('.profile h2')?.textContent;

  /** Picks an applicant by name, then clicks Score resume or Re-score. */
  const scoreFromCard = (name: string, button: string) => {
    Array.from(el().querySelectorAll<HTMLButtonElement>('.who__name'))
      .find((b) => b.textContent?.includes(name))
      ?.click();
    fixture.detectChanges();
    Array.from(el().querySelectorAll<HTMLButtonElement>('.detail button'))
      .find((b) => b.textContent?.includes(button))
      ?.click();
    fixture.detectChanges();
  };

  const completed = (row: ApplicationRow, fit_score: number): AiScreening => ({
    id: row.id,
    application_id: row.id,
    fit_score,
    explanation: 'Meets the main requirements.',
    requirement_matches: [],
    status: ScreeningStatus.COMPLETED,
    failure_reason: null,
    retry_count: 0,
    screened_at: '2026-11-06T01:00:00Z',
  });

  async function render(list: ApplicationRow[] = WITH_HANA_RESUME) {
    TestBed.configureTestingModule({
      imports: [Applications],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // The detail panel links to the applicant's profile page.
        provideRouter([]),
      ],
    });
    fixture = TestBed.createComponent(Applications);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(LIST_URL).flush(structuredClone(list));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('loads applicants from the API, highest fit score first', async () => {
    await render();
    expect(names().length).toBe(TEST_APPLICATIONS.length);
    expect(names()[0]).toBe('Mei-Lin Chen');
    expect(names().at(-1)).toBe('Hana Kim'); // unscored go last
    expect(el().textContent).not.toContain('sample');
  });

  it('shows a loading message, then an error with a retry', async () => {
    TestBed.configureTestingModule({
      imports: [Applications],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // The detail panel links to the applicant's profile page.
        provideRouter([]),
      ],
    });
    fixture = TestBed.createComponent(Applications);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    expect(el().textContent).toContain('Loading applicants…');

    http
      .expectOne(LIST_URL)
      .flush(
        { error: 'Something broke.' },
        { status: 500, statusText: 'Server Error' },
      );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el().textContent).toContain('Something broke.');

    el().querySelector<HTMLButtonElement>('.load-error button')?.click();
    http.expectOne(LIST_URL).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el().textContent).toContain('No one has applied yet.');
  });

  it('shows a fit score badge on each row', async () => {
    await render();
    expect(el().querySelectorAll('.row app-fit-score-badge').length).toBe(
      TEST_APPLICATIONS.length,
    );
  });

  it('counts and filters by fit tier', async () => {
    await render();
    expect(chip('Strong fit')?.textContent).toContain('2');
    chip('Strong fit')?.click();
    fixture.detectChanges();
    expect(names()).toEqual(['Mei-Lin Chen', 'Jonah Reyes']);
  });

  it('searches by name or email', async () => {
    await render();
    const input = el().querySelector<HTMLInputElement>('input[type=search]')!;
    input.value = 'okafor';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(names()).toEqual(['Daniel Okafor']);
  });

  it('opens the fit score card for the picked applicant', async () => {
    await render();
    expect(detailName()).toBe('Mei-Lin Chen');
    expect(el().querySelector('.detail app-fit-score-card')).not.toBeNull();

    el().querySelectorAll<HTMLButtonElement>('.who__name')[2].click();
    fixture.detectChanges();
    expect(detailName()).toBe(names()[2]);
  });

  it('screens a resume for the first time', async () => {
    await render();
    const hana = byName('Hana Kim');
    scoreFromCard('Hana Kim', 'Score resume');
    expect(el().textContent).toContain('Scoring…');

    const req = http.expectOne(SCREEN_URL);
    expect(req.request.body).toEqual({ application_id: hana.id });
    req.flush({ message: 'ok', screening: completed(hana, 80) });
    await fixture.whenStable();
    fixture.detectChanges();

    chip('Strong fit')?.click();
    fixture.detectChanges();
    expect(names()).toContain('Hana Kim');
  });

  it('retries a failed screening from the row', async () => {
    await render();
    const lucas = byName('Lucas Martin');
    chip('Not scored')?.click();
    fixture.detectChanges();
    el().querySelector<HTMLButtonElement>('.failed__retry')?.click();
    fixture.detectChanges();

    const req = http.expectOne(SCREEN_URL);
    expect(req.request.body).toEqual({
      application_id: lucas.id,
      retry: true,
    });
    req.flush({ message: 'ok', screening: completed(lucas, 70) });
    await fixture.whenStable();
    fixture.detectChanges();
    // Lucas now has a score, so he leaves the "Not scored" filter.
    expect(names()).toEqual(['Hana Kim']);
  });

  it('shows why a screening failed', async () => {
    await render();
    const hana = byName('Hana Kim');
    scoreFromCard('Hana Kim', 'Score resume');

    http.expectOne(SCREEN_URL).flush(
      {
        error: 'AI screening could not be completed.',
        status: ScreeningStatus.FAILED,
        retry_count: 0,
        failure_reason: 'The AI service is busy right now.',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    // The saved failure is loaded so the card can show the reason.
    http.expectOne(`${SCREEN_URL}/${hana.id}`).flush({
      ...completed(hana, 0),
      fit_score: null,
      status: ScreeningStatus.FAILED,
      failure_reason: 'The AI service is busy right now.',
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el().textContent).toContain('The AI service is busy right now.');
  });

  it('does not score an applicant without a resume', async () => {
    await render([byName('Hana Kim')]); // no resume uploaded
    scoreFromCard('Hana Kim', 'Score resume');

    http.expectNone(SCREEN_URL);
    expect(el().textContent).toContain('has not uploaded a resume yet');
  });

  it('shows other errors, like the daily limit or no access', async () => {
    await render();
    scoreFromCard('Hana Kim', 'Score resume');
    http
      .expectOne(SCREEN_URL)
      .flush(
        { error: 'Your role does not have access to this action.' },
        { status: 403, statusText: 'Forbidden' },
      );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el().textContent).toContain(
      'Your role does not have access to this action.',
    );
    expect(el().textContent).not.toContain('Scoring…');
  });
});
