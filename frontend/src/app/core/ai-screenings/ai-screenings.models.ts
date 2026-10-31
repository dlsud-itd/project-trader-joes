/**
 * AI screening results (API spec VI). Mirrors the backend's `ai_screenings`
 * row, so the fit score badge and breakdown card can render it as is.
 */

/** How well the resume shows one posting requirement. */
export type RequirementMatchLevel = 'met' | 'partial' | 'missing';

export type RequirementMatch = {
  requirement: string;
  match: RequirementMatchLevel;
  evidence: string;
};

/** `completed` has a fit score; `failed` can be retried. */
export type ScreeningStatus = 'completed' | 'failed';

export type AiScreening = {
  id: number;
  application_id: number;
  /** 0–100; null while the screening has failed. */
  fit_score: number | null;
  explanation: string | null;
  requirement_matches: RequirementMatch[] | null;
  status: ScreeningStatus;
  retry_count: number;
  screened_at: string;
};

/** POST /api/ai-screenings */
export type AiScreeningResponse = {
  message: string;
  screening: AiScreening;
};

/** The three bands from the UI/UX mockup. */
export type FitTier = 'strong' | 'possible' | 'weak';

export const FIT_TIER_MIN = { strong: 80, possible: 60 } as const;

export const FIT_TIER_LABEL: Record<FitTier, string> = {
  strong: 'Strong fit',
  possible: 'Possible fit',
  weak: 'Weak fit',
};

export const MATCH_LABEL: Record<RequirementMatchLevel, string> = {
  met: 'Meets',
  partial: 'Partial',
  missing: 'Missing',
};

/** 80+ is strong, 60–79 possible, below 60 weak. */
export function fitTier(score: number): FitTier {
  if (score >= FIT_TIER_MIN.strong) return 'strong';
  if (score >= FIT_TIER_MIN.possible) return 'possible';
  return 'weak';
}

/** Keeps a score inside 0–100 and whole, whatever the API sent. */
export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, Math.round(score)));
}

export type MatchCounts = Record<RequirementMatchLevel, number> & {
  total: number;
};

export function countMatches(
  matches: readonly RequirementMatch[] | null | undefined,
): MatchCounts {
  const counts: MatchCounts = { met: 0, partial: 0, missing: 0, total: 0 };
  for (const m of matches ?? []) {
    counts[m.match] += 1;
    counts.total += 1;
  }
  return counts;
}
