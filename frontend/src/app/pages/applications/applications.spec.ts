import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Applications, fitGroup } from './applications';
import { ApplicationRow, SAMPLE_APPLICATIONS } from './sample-applications';

const byName = (name: string) =>
  SAMPLE_APPLICATIONS.find((r) => r.full_name === name) as ApplicationRow;

describe('fitGroup', () => {
  it('groups by fit tier, and unscored when there is no score', () => {
    expect(fitGroup(byName('Mei-Lin Chen'))).toBe('strong');
    expect(fitGroup(byName('Aisha Rahman'))).toBe('possible');
    expect(fitGroup(byName('Daniel Okafor'))).toBe('weak');
    expect(fitGroup(byName('Lucas Martin'))).toBe('unscored'); // failed
    expect(fitGroup(byName('Hana Kim'))).toBe('unscored'); // not screened
  });
});

describe('Applications', () => {
  let fixture: ComponentFixture<Applications>;

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

  beforeEach(() => {
    vi.useFakeTimers();
    fixture = TestBed.createComponent(Applications);
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  it('lists every applicant, highest fit score first', () => {
    expect(names().length).toBe(SAMPLE_APPLICATIONS.length);
    expect(names()[0]).toBe('Mei-Lin Chen');
    expect(names().at(-1)).toBe('Hana Kim'); // unscored go last
  });

  it('shows a fit score badge on each row', () => {
    expect(el().querySelectorAll('.row app-fit-score-badge').length).toBe(
      SAMPLE_APPLICATIONS.length,
    );
  });

  it('counts and filters by fit tier', () => {
    expect(chip('Strong fit')?.textContent).toContain('2');
    chip('Strong fit')?.click();
    fixture.detectChanges();
    expect(names()).toEqual(['Mei-Lin Chen', 'Jonah Reyes']);
  });

  it('searches by name or email', () => {
    const input = el().querySelector<HTMLInputElement>('input[type=search]')!;
    input.value = 'okafor';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(names()).toEqual(['Daniel Okafor']);
  });

  it('opens the fit score card for the picked applicant', () => {
    expect(detailName()).toBe('Mei-Lin Chen');
    expect(el().querySelector('.detail app-fit-score-card')).not.toBeNull();

    el().querySelectorAll<HTMLButtonElement>('.who__name')[2].click();
    fixture.detectChanges();
    expect(detailName()).toBe(names()[2]);
  });

  it('retries a failed screening from the row', () => {
    chip('Not scored')?.click();
    fixture.detectChanges();
    el().querySelector<HTMLButtonElement>('.failed__retry')?.click();
    fixture.detectChanges();
    expect(el().textContent).toContain('Scoring…');

    vi.runAllTimers();
    fixture.detectChanges();
    // Lucas now has a score, so he leaves the "Not scored" filter.
    expect(names()).toEqual(['Hana Kim']);
  });
});
