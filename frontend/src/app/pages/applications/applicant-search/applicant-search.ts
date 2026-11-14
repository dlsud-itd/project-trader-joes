import {
  RequirementMatch,
  RequirementMatchLevel,
  ScreeningStatus,
} from '../../../core/ai-screenings';
import {
  ApplicationRow,
  KANBAN_STAGES,
  KanbanStage,
} from '../../../core/applications';

/**
 * Search, filters, and multi-sort for the Applications page (WBS 4.5.1.1).
 * Plain functions over the loaded list, so the List and Board views share
 * them and they can be tested without the page.
 */

/** One way to order applicants. The page sorts by one, then by another. */
export enum SortOption {
  FIT_HIGH = 'fit-desc',
  FIT_LOW = 'fit-asc',
  NEWEST = 'newest',
  OLDEST = 'oldest',
  NAME_AZ = 'name-asc',
  NAME_ZA = 'name-desc',
  STAGE = 'stage',
}

export const SORT_LABEL: Record<SortOption, string> = {
  [SortOption.FIT_HIGH]: 'Fit score: high to low',
  [SortOption.FIT_LOW]: 'Fit score: low to high',
  [SortOption.NEWEST]: 'Newest first',
  [SortOption.OLDEST]: 'Oldest first',
  [SortOption.NAME_AZ]: 'Name: A to Z',
  [SortOption.NAME_ZA]: 'Name: Z to A',
  [SortOption.STAGE]: 'Stage: Applied to Rejected',
};

export const SORT_OPTIONS: readonly SortOption[] = Object.values(SortOption);

/** How recently the applicant applied. Values are days, except ANY. */
export enum AppliedWithin {
  ANY = 'any',
  DAY = '1',
  WEEK = '7',
  MONTH = '30',
}

export const APPLIED_LABEL: Record<AppliedWithin, string> = {
  [AppliedWithin.ANY]: 'Any time',
  [AppliedWithin.DAY]: 'Last 24 hours',
  [AppliedWithin.WEEK]: 'Last 7 days',
  [AppliedWithin.MONTH]: 'Last 30 days',
};

export enum ResumeFilter {
  ANY = 'any',
  WITH = 'with',
  WITHOUT = 'without',
}

export const RESUME_LABEL: Record<ResumeFilter, string> = {
  [ResumeFilter.ANY]: 'Any',
  [ResumeFilter.WITH]: 'Uploaded',
  [ResumeFilter.WITHOUT]: 'Missing',
};

/** Everything the search toolbar sets. `null` means "all". */
export type ApplicantQuery = {
  text: string;
  postingId: number | null;
  stage: KanbanStage | null;
  applied: AppliedWithin;
  resume: ResumeFilter;
  sort: SortOption;
  thenBy: SortOption | null;
};

export const DEFAULT_QUERY: ApplicantQuery = {
  text: '',
  postingId: null,
  stage: null,
  applied: AppliedWithin.ANY,
  resume: ResumeFilter.ANY,
  sort: SortOption.FIT_HIGH,
  thenBy: SortOption.NEWEST,
};

/** A posting in the Posting filter. */
export type PostingOption = {
  id: number;
  title: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** How many search and filter fields are set; sorting doesn't count. */
export function activeFilterCount(query: ApplicantQuery): number {
  return [
    query.text.trim() !== '',
    query.postingId !== null,
    query.stage !== null,
    query.applied !== AppliedWithin.ANY,
    query.resume !== ResumeFilter.ANY,
  ].filter(Boolean).length;
}

/** Clears the search and filters but keeps the chosen sort. */
export function clearFilters(query: ApplicantQuery): ApplicantQuery {
  return { ...DEFAULT_QUERY, sort: query.sort, thenBy: query.thenBy };
}

/** The postings that have applicants, A to Z, for the Posting filter. */
export function postingOptions(rows: ApplicationRow[]): PostingOption[] {
  const byId = new Map<number, string>();
  for (const row of rows) byId.set(row.job_posting_id, row.posting_title);
  return [...byId]
    .map(([id, title]: [number, string]) => ({ id, title }))
    .sort((a: PostingOption, b: PostingOption) =>
      a.title.localeCompare(b.title),
    );
}

/** Lowercase without accents, so "pena" finds "Peña". */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Requirements the AI found in the resume, so "angular" finds them. */
function shownSkills(row: ApplicationRow): string[] {
  const matches: RequirementMatch[] = row.screening?.requirement_matches ?? [];
  return matches
    .filter((m: RequirementMatch) => m.match !== RequirementMatchLevel.MISSING)
    .map((m: RequirementMatch) => m.requirement);
}

function searchableText(row: ApplicationRow): string {
  const phone = row.phone ?? '';
  return normalize(
    [
      row.full_name,
      row.email,
      phone,
      // Digits only too, so "0917555" finds "+63 917 555 0101".
      phone.replace(/\D/g, ''),
      row.posting_title,
      row.cover_note ?? '',
      ...shownSkills(row),
    ].join('\n'),
  );
}

/**
 * Every word must appear somewhere in the name, email, phone, posting,
 * cover note, or the skills the AI found, in any order.
 */
export function matchesText(row: ApplicationRow, text: string): boolean {
  const words = normalize(text).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = searchableText(row);
  return words.every((word: string) => haystack.includes(word));
}

/** The posting, stage, applied date, and resume filters. */
export function matchesFilters(
  row: ApplicationRow,
  query: ApplicantQuery,
  now: Date,
): boolean {
  if (query.postingId !== null && row.job_posting_id !== query.postingId) {
    return false;
  }
  if (query.stage !== null && row.kanban_stage !== query.stage) return false;
  if (query.resume === ResumeFilter.WITH && !row.resume) return false;
  if (query.resume === ResumeFilter.WITHOUT && row.resume) return false;
  if (query.applied !== AppliedWithin.ANY) {
    const since = now.getTime() - Number(query.applied) * DAY_MS;
    if (Date.parse(row.submitted_at) < since) return false;
  }
  return true;
}

/** Text search and filters together. */
export function matchesQuery(
  row: ApplicationRow,
  query: ApplicantQuery,
  now: Date,
): boolean {
  return matchesFilters(row, query, now) && matchesText(row, query.text);
}

type Compare = (a: ApplicationRow, b: ApplicationRow) => number;

/** Only a finished screening has a score to sort by. */
function fitScore(row: ApplicationRow): number | null {
  const s = row.screening;
  return s?.status === ScreeningStatus.COMPLETED ? s.fit_score : null;
}

/** Compares scores either way, always keeping unscored applicants last. */
function byFit(direction: 1 | -1): Compare {
  return (a: ApplicationRow, b: ApplicationRow) => {
    const x = fitScore(a);
    const y = fitScore(b);
    if (x === null || y === null)
      return Number(x === null) - Number(y === null);
    return (x - y) * direction;
  };
}

const byDate: Compare = (a: ApplicationRow, b: ApplicationRow) =>
  a.submitted_at.localeCompare(b.submitted_at);

const byName: Compare = (a: ApplicationRow, b: ApplicationRow) =>
  a.full_name.localeCompare(b.full_name, undefined, { sensitivity: 'base' });

const byStage: Compare = (a: ApplicationRow, b: ApplicationRow) =>
  KANBAN_STAGES.indexOf(a.kanban_stage) - KANBAN_STAGES.indexOf(b.kanban_stage);

const COMPARE: Record<SortOption, Compare> = {
  [SortOption.FIT_HIGH]: byFit(-1),
  [SortOption.FIT_LOW]: byFit(1),
  [SortOption.NEWEST]: (a: ApplicationRow, b: ApplicationRow) => byDate(b, a),
  [SortOption.OLDEST]: byDate,
  [SortOption.NAME_AZ]: byName,
  [SortOption.NAME_ZA]: (a: ApplicationRow, b: ApplicationRow) => byName(b, a),
  [SortOption.STAGE]: byStage,
};

/**
 * A sorted copy: by the first option, ties broken by the next ones, then
 * by application id so the order never jumps around between renders.
 */
export function sortApplications(
  rows: readonly ApplicationRow[],
  options: readonly (SortOption | null)[],
): ApplicationRow[] {
  const chain = options
    .filter((o: SortOption | null): o is SortOption => o !== null)
    .map((o: SortOption) => COMPARE[o]);
  return [...rows].sort((a: ApplicationRow, b: ApplicationRow) => {
    for (const compare of chain) {
      const order = compare(a, b);
      if (order !== 0) return order;
    }
    return a.id - b.id;
  });
}
