import { Component, computed, input, output } from '@angular/core';
import {
  clampScore,
  FIT_TIER_LABEL,
  fitTier,
  ScreeningStatus,
} from '../../core/ai-screenings';

/**
 * Variants for the views inside the applications page:
 * - `ring`: score ring with the tier beside it (list view).
 * - `pill`: compact chip (pipeline board cards).
 * - `hero`: large ring with the tier underneath (compare view, breakdown card).
 */
export type FitScoreBadgeVariant = 'ring' | 'pill' | 'hero';

type BadgeState = 'scored' | 'scoring' | 'failed' | 'none';

/**
 * Shows an application's AI fit score (WBS 4.3.3.2). Also covers the
 * states around it: not screened yet, scoring, and failed with a retry.
 */
@Component({
  selector: 'app-fit-score-badge',
  templateUrl: './fit-score-badge.html',
  styleUrl: './fit-score-badge.scss',
  host: {
    '[class]': '"is-" + variant()',
  },
})
export class FitScoreBadge {
  /** 0–100, or null when there is no score. */
  readonly score = input<number | null | undefined>(null);
  /** The screening's status; null when the application has none yet. */
  readonly status = input<ScreeningStatus | null | undefined>(null);
  /** True while a screening request is in flight. */
  readonly busy = input(false);
  readonly variant = input<FitScoreBadgeVariant>('ring');

  /** Asks the parent to run the failed screening again. */
  readonly retry = output<void>();

  protected readonly state = computed<BadgeState>(() => {
    if (this.busy()) return 'scoring';
    if (this.status() === 'failed') return 'failed';
    const score = this.score();
    if (this.status() === 'completed' && score != null) return 'scored';
    return 'none';
  });

  protected readonly value = computed(() => clampScore(this.score() ?? 0));
  protected readonly tier = computed(() => fitTier(this.value()));
  protected readonly tierLabel = computed(() => FIT_TIER_LABEL[this.tier()]);

  protected readonly ariaLabel = computed(() => {
    switch (this.state()) {
      case 'scored':
        return `AI fit score ${this.value()} out of 100, ${this.tierLabel().toLowerCase()}`;
      case 'scoring':
        return 'AI fit score: scoring';
      case 'failed':
        return 'AI fit score: analysis failed';
      default:
        return 'AI fit score: not screened';
    }
  });
}
