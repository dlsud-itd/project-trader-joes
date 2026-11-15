import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StarRating } from './star-rating';

describe('StarRating', () => {
  let fixture: ComponentFixture<StarRating>;
  let rated: number[];

  const radios = () =>
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>(
        'input[type=radio]',
      ),
    );
  const lit = () =>
    (fixture.nativeElement as HTMLElement).querySelectorAll('.star.is-on')
      .length;

  beforeEach(() => {
    fixture = TestBed.createComponent(StarRating);
    rated = [];
    fixture.componentInstance.rate.subscribe((r: number) => rated.push(r));
    fixture.detectChanges();
  });

  it('is a group of five labelled radio buttons', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('legend')?.textContent).toContain('Your rating');
    expect(radios()).toHaveLength(5);
    expect(el.textContent).toContain('1 star');
    expect(el.textContent).toContain('5 stars');
    // One group name, so arrow keys move between the stars.
    expect(new Set(radios().map((r) => r.name)).size).toBe(1);
  });

  it('shows the current rating', () => {
    fixture.componentRef.setInput('value', 3);
    fixture.detectChanges();
    expect(radios()[2].checked).toBe(true);
    expect(lit()).toBe(3);
  });

  it('emits the chosen star, but not the one already chosen', () => {
    fixture.componentRef.setInput('value', 3);
    fixture.detectChanges();
    radios()[3].dispatchEvent(new Event('change'));
    radios()[2].dispatchEvent(new Event('change'));
    expect(rated).toEqual([4]);
  });

  it('previews a rating on hover', () => {
    const stars = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.star',
    );
    stars[4].dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    expect(lit()).toBe(5);
    (fixture.nativeElement as HTMLElement)
      .querySelector('fieldset')
      ?.dispatchEvent(new Event('mouseleave'));
    fixture.detectChanges();
    expect(lit()).toBe(0);
  });

  it('can be disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('fieldset')
        ?.disabled,
    ).toBe(true);
  });
});
