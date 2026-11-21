import { RequirementMatch, ScreeningStatus } from '../../../core/ai-screenings';
import { ApplicationRow } from '../../../core/applications';

/**
 * Helpers for comparing applicants side by side (WBS 4.5.3.1). Fit scores
 * are measured against each applicant's own posting, so a comparison is for
 * one job: only applicants of the same posting can be picked together. The
 * ids live in the URL as `?compare=101,102` so a comparison can be shared
 * and survives a refresh.
 */

/** The query parameter that holds the compared application ids. */
export const COMPARE_PARAM = 'compare';
/** Fewer than two is not a comparison. */
export const MIN_COMPARE = 2;
/** More than four columns no longer fit side by side. */
export const MAX_COMPARE = 4;

/** "101,102" → [101, 102], skipping junk and repeats, at most four. */
export function parseCompareIds(value: string | null): number[] {
  const ids: number[] = [];
  for (const part of (value ?? '').split(',')) {
    const id = Number(part.trim());
    const isValid = Number.isInteger(id) && id > 0 && !ids.includes(id);
    if (isValid) ids.push(id);
  }
  return ids.slice(0, MAX_COMPARE);
}

/** The URL value for these ids, or null to drop the parameter. */
export function compareParam(ids: Iterable<number>): string | null {
  const list = [...ids].slice(0, MAX_COMPARE);
  return list.length ? list.join(',') : null;
}

/** The applications for these ids, in the same order; unknown ids drop out. */
export function pickRows(
  rows: readonly ApplicationRow[],
  ids: readonly number[],
): ApplicationRow[] {
  return ids
    .map((id: number) => rows.find((r: ApplicationRow) => r.id === id))
    .filter((r: ApplicationRow | undefined): r is ApplicationRow => !!r);
}

/** The job being compared for, or null when the applicants' jobs differ. */
export function sharedPosting(
  rows: readonly ApplicationRow[],
): { id: number; title: string } | null {
  const first = rows[0];
  if (!first) return null;
  const isSame = rows.every(
    (r: ApplicationRow) => r.job_posting_id === first.job_posting_id,
  );
  return isSame
    ? { id: first.job_posting_id, title: first.posting_title }
    : null;
}

/** Every distinct job title among the applicants, in order. */
export function postingTitles(rows: readonly ApplicationRow[]): string[] {
  return [...new Set(rows.map((r: ApplicationRow) => r.posting_title))];
}

/** Only a finished screening has a score worth comparing. */
export function isScreened(row: ApplicationRow): boolean {
  return row.screening?.status === ScreeningStatus.COMPLETED;
}

/**
 * The applicants with the highest fit score. Empty unless at least two are
 * scored for the same job and someone actually scores higher: one score
 * alone isn't "the best" of anything, scores for different jobs measure
 * different things, and a full tie has no winner.
 */
export function bestFitIds(rows: readonly ApplicationRow[]): Set<number> {
  if (!sharedPosting(rows)) return new Set();
  const scored = rows.filter(
    (r: ApplicationRow) => isScreened(r) && r.screening?.fit_score != null,
  );
  if (scored.length < MIN_COMPARE) return new Set();
  const top = Math.max(
    ...scored.map((r: ApplicationRow) => r.screening?.fit_score ?? 0),
  );
  const best = scored.filter(
    (r: ApplicationRow) => r.screening?.fit_score === top,
  );
  // When every scored applicant ties, nobody stands out.
  if (best.length === scored.length) return new Set();
  return new Set(best.map((r: ApplicationRow) => r.id));
}

/** One requirement and how each compared applicant matches it. */
export type RequirementRow = {
  requirement: string;
  /** One per applicant, in column order; null when it wasn't checked. */
  matches: (RequirementMatch | null)[];
};

const key = (requirement: string): string => requirement.trim().toLowerCase();

/**
 * Every requirement from the compared screenings, in the order they first
 * appear. Applicants from different postings can have different lists, so
 * a requirement another posting didn't ask for shows as null.
 */
export function requirementRows(
  rows: readonly ApplicationRow[],
): RequirementRow[] {
  const byKey = new Map<string, RequirementRow>();
  rows.forEach((row: ApplicationRow, column: number) => {
    const matches = isScreened(row)
      ? (row.screening?.requirement_matches ?? [])
      : [];
    for (const match of matches) {
      let line = byKey.get(key(match.requirement));
      if (!line) {
        line = {
          requirement: match.requirement,
          matches: rows.map(() => null),
        };
        byKey.set(key(match.requirement), line);
      }
      line.matches[column] = match;
    }
  });
  return [...byKey.values()];
}
