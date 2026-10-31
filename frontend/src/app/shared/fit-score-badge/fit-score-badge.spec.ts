import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScreeningStatus } from '../../core/ai-screenings';
import { FitScoreBadge } from './fit-score-badge';

describe('FitScoreBadge', () => {
  let fixture: ComponentFixture<FitScoreBadge>;

  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const set = (inputs: Record<string, unknown>) => {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(FitScoreBadge);
    fixture.detectChanges();
  });

  it('shows "Not screened" without a screening', () => {
    expect(text()).toBe('Not screened');
  });

  it('shows the score and tier for a completed screening', () => {
    set({ status: ScreeningStatus.COMPLETED, score: 92 });
    expect(text()).toContain('92');
    expect(text()).toContain('Strong fit');
    expect(text()).toContain('AI fit score');
    const label = el().querySelector('[role=img]')?.getAttribute('aria-label');
    expect(label).toBe('AI fit score 92 out of 100, strong fit');
  });

  it('fills the ring to the score', () => {
    set({ status: ScreeningStatus.COMPLETED, score: 73 });
    const arc = el().querySelector('.ring__arc');
    expect(arc?.getAttribute('stroke-dasharray')).toBe('73 100');
    expect(el().querySelector('.tier-possible')).not.toBeNull();
  });

  it('marks low scores as a weak fit', () => {
    set({ status: ScreeningStatus.COMPLETED, score: 41 });
    expect(text()).toContain('Weak fit');
    expect(el().querySelector('.tier-weak')).not.toBeNull();
  });

  it('renders the compact pill variant', () => {
    set({ status: ScreeningStatus.COMPLETED, score: 88, variant: 'pill' });
    expect(el().querySelector('.pill')).not.toBeNull();
    expect(text()).toMatch(/^88\s*Strong fit$/);
    expect(el().classList).toContain('is-pill');
  });

  it('shows a spinner while scoring', () => {
    set({ status: ScreeningStatus.COMPLETED, score: 88, busy: true });
    expect(text()).toBe('Scoring…');
    expect(el().querySelector('[role=status]')).not.toBeNull();
  });

  it('offers a retry when the screening failed', () => {
    let retried = 0;
    fixture.componentInstance.retry.subscribe(() => retried++);
    set({ status: ScreeningStatus.FAILED });
    expect(text()).toContain('Analysis failed');
    el().querySelector<HTMLButtonElement>('.failed__retry')?.click();
    expect(retried).toBe(1);
  });

  it('leaves the retry button out of the pill', () => {
    set({ status: ScreeningStatus.FAILED, variant: 'pill' });
    expect(text()).toBe('Failed');
    expect(el().querySelector('button')).toBeNull();
  });
});
