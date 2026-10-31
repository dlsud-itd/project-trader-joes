import {
  RequirementMatch,
  RequirementMatchLevel,
} from './ai-screenings.models';

/**
 * Helpers for showing a fit score (WBS 4.3.3.2): the strong / possible /
 * weak bands from the UI/UX mockup, and requirement counts.
 */

export enum FitTier {
  STRONG = 'strong',
  POSSIBLE = 'possible',
  WEAK = 'weak',
}

/** Lowest score in each band. */
export const FIT_TIER_MIN = { strong: 80, possible: 60 } as const;

export const FIT_TIER_LABEL: Record<FitTier, string> = {
  [FitTier.STRONG]: 'Strong fit',
  [FitTier.POSSIBLE]: 'Possible fit',
  [FitTier.WEAK]: 'Weak fit',
};

export const MATCH_LABEL: Record<RequirementMatchLevel, string> = {
  [RequirementMatchLevel.MET]: 'Meets',
  [RequirementMatchLevel.PARTIAL]: 'Partial',
  [RequirementMatchLevel.MISSING]: 'Missing',
};

const MIN_SCORE = 0;
const MAX_SCORE = 100;

/** 80+ is strong, 60–79 possible, below 60 weak. */
export function fitTier(score: number): FitTier {
  if (score >= FIT_TIER_MIN.strong) return FitTier.STRONG;
  if (score >= FIT_TIER_MIN.possible) return FitTier.POSSIBLE;
  return FitTier.WEAK;
}

/** Keeps a score inside 0–100 and whole, whatever the API sent. */
export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return MIN_SCORE;
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, Math.round(score)));
}

export type MatchCounts = Record<RequirementMatchLevel, number> & {
  total: number;
};

export function countMatches(
  matches: readonly RequirementMatch[] | null | undefined,
): MatchCounts {
  const counts: MatchCounts = {
    [RequirementMatchLevel.MET]: 0,
    [RequirementMatchLevel.PARTIAL]: 0,
    [RequirementMatchLevel.MISSING]: 0,
    total: 0,
  };
  for (const match of matches ?? []) {
    counts[match.match] += 1;
    counts.total += 1;
  }
  return counts;
}
