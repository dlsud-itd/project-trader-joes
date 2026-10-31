import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AiScreening, RequirementMatch } from '../../core/ai-screenings';
import { FitScoreCard } from './fit-score-card';

const match = (
  requirement: string,
  level: RequirementMatch['match'],
  evidence = '',
): RequirementMatch => ({ requirement, match: level, evidence });

const completed = (overrides: Partial<AiScreening> = {}): AiScreening => ({
  id: 1,
  application_id: 7,
  fit_score: 75,
  explanation: 'Solid Angular and TypeScript work; no testing experience.',
  requirement_matches: [
    match('Angular', 'met', 'Built a capstone portal in Angular 20.'),
    match('TypeScript', 'met', 'Three years of TypeScript.'),
    match('Git', 'partial', 'Used GitHub for coursework.'),
    match('Unit testing', 'missing', 'No testing tools listed.'),
  ],
  status: 'completed',
  retry_count: 0,
  screened_at: '2026-10-31T04:00:00Z',
  ...overrides,
});

describe('FitScoreCard', () => {
  let fixture: ComponentFixture<FitScoreCard>;

  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const button = (label: string) =>
    Array.from(el().querySelectorAll('button')).find((b) =>
      b.textContent?.includes(label),
    );
  const set = (inputs: Record<string, unknown>) => {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(FitScoreCard);
    fixture.detectChanges();
  });

  it('offers to score an application that has no screening', () => {
    let runs = 0;
    fixture.componentInstance.run.subscribe(() => runs++);
    expect(text()).toContain("hasn't been screened");
    button('Score resume')?.click();
    expect(runs).toBe(1);
  });

  it('shows the score, counts, and written explanation', () => {
    set({ screening: completed() });
    expect(text()).toContain('75');
    expect(text()).toContain('Possible fit');
    expect(text()).toContain('Meets 2 of 4 requirements');
    expect(text()).toContain('2 met');
    expect(text()).toContain('1 partial');
    expect(text()).toContain('1 missing');
    expect(text()).toContain('Solid Angular and TypeScript work');
  });

  it('lists each requirement with its status and evidence', () => {
    set({ screening: completed() });
    const rows = el().querySelectorAll('.req');
    expect(rows.length).toBe(4);
    expect(rows[0].classList).toContain('is-met');
    expect(rows[0].textContent).toContain('Meets');
    expect(rows[0].textContent).toContain('Built a capstone portal');
    expect(rows[2].textContent).toContain('Partial');
    expect(rows[3].textContent).toContain('Missing');
  });

  it('only draws bar segments for levels that occur', () => {
    set({
      screening: completed({
        fit_score: 100,
        requirement_matches: [match('A', 'met'), match('B', 'met')],
      }),
    });
    const segments = el().querySelectorAll('.bar__seg');
    expect(segments.length).toBe(1);
    expect((segments[0] as HTMLElement).style.width).toBe('100%');
  });

  it('collapses long requirement lists', () => {
    const many = Array.from({ length: 8 }, (_, i) => match(`Req ${i}`, 'met'));
    set({ screening: completed({ requirement_matches: many }) });
    expect(el().querySelectorAll('.req').length).toBe(5);

    button('Show all 8')?.click();
    fixture.detectChanges();
    expect(el().querySelectorAll('.req').length).toBe(8);

    button('Show less')?.click();
    fixture.detectChanges();
    expect(el().querySelectorAll('.req').length).toBe(5);
  });

  it('shows the attempt number after a retry', () => {
    set({ screening: completed({ retry_count: 2 }) });
    expect(text()).toContain('attempt 3');
  });

  it('lets a finished screening be scored again', () => {
    let retries = 0;
    fixture.componentInstance.retry.subscribe(() => retries++);
    set({ screening: completed() });
    button('Re-score')?.click();
    expect(retries).toBe(1);
  });

  it('explains a failed screening and offers a retry', () => {
    let retries = 0;
    fixture.componentInstance.retry.subscribe(() => retries++);
    set({
      screening: completed({
        status: 'failed',
        fit_score: null,
        explanation: null,
        requirement_matches: null,
      }),
    });
    expect(text()).toContain("couldn't be scored");
    expect(el().querySelector('.reqs')).toBeNull();
    button('Retry')?.click();
    expect(retries).toBe(1);
  });

  it('shows progress while scoring', () => {
    set({ screening: completed(), busy: true });
    expect(text()).toContain('Scoring resume');
    expect(el().querySelector('.reqs')).toBeNull();
    expect(button('Re-score')).toBeUndefined();
  });
});
