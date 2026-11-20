import { RequirementMatch, ScreeningStatus } from '../../../core/ai-screenings';
import { ApplicationRow } from '../../../core/applications';

/**
 * Helpers for comparing applicants side by side (WBS 4.5.3.1). The ids
 * live in the URL as `?compare=101,102` so a comparison can be shared and
 * survives a refresh.
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

/** Only a finished screening has a score worth comparing. */
export function isScreened(row: ApplicationRow): boolean {
  return row.screening?.status === ScreeningStatus.COMPLETED;
}

/**
 * The applicants with the highest fit score. Empty unless at least two are
 * scored, since one score alone isn't "the best" of anything.
 */
export function bestFitIds(rows: readonly ApplicationRow[]): Set<number> {
  const scored = rows.filter(
    (r: ApplicationRow) => isScreened(r) && r.screening?.fit_score != null,
  );
  if (scored.length < MIN_COMPARE) return new Set();
  const top = Math.max(
    ...scored.map((r: ApplicationRow) => r.screening?.fit_score ?? 0),
  );
  return new Set(
    scored
      .filter((r: ApplicationRow) => r.screening?.fit_score === top)
      .map((r: ApplicationRow) => r.id),
  );
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
