import { Component, computed, input, output, signal } from '@angular/core';
import { RATING_MAX } from '../../core/reviews';

let nextId = 0;

/**
 * A 1–5 star input. Each star is a radio button, so arrow keys move between
 * them and screen readers say "3 stars, 3 of 5". Hovering previews a rating.
 */
@Component({
  selector: 'app-star-rating',
  templateUrl: './star-rating.html',
  styleUrl: './star-rating.scss',
})
export class StarRating {
  /** The chosen rating; null when there is none. */
  readonly value = input<number | null>(null);
  /** Read by screen readers as the group's name. */
  readonly label = input('Your rating');
  readonly disabled = input(false);

  /** A star was chosen. */
  readonly rate = output<number>();

  protected readonly name = `star-rating-${nextId++}`;
  protected readonly stars: readonly number[] = Array.from(
    { length: RATING_MAX },
    (_: unknown, i: number) => i + 1,
  );
  protected readonly preview = signal<number | null>(null);
  /** What the stars show: the hovered star, or else the chosen one. */
  protected readonly shown = computed(
    () => this.preview() ?? this.value() ?? 0,
  );

  protected starLabel(star: number): string {
    return star === 1 ? '1 star' : `${star} stars`;
  }

  protected choose(star: number): void {
    if (this.disabled() || star === this.value()) return;
    this.rate.emit(star);
  }
}
