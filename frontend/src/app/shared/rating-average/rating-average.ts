import { Component, computed, input } from '@angular/core';
import { RatingAverage, ratingLabel } from '../../core/reviews';

/** The team's average rating as "★ 3.5 (2)", or a dash when unrated. */
@Component({
  selector: 'app-rating-average',
  templateUrl: './rating-average.html',
  styleUrl: './rating-average.scss',
})
export class RatingAverageBadge {
  readonly rating = input.required<RatingAverage>();

  protected readonly label = computed(() =>
    this.rating().average === null
      ? 'Not rated yet'
      : `Average rating ${ratingLabel(this.rating())}`,
  );
}
