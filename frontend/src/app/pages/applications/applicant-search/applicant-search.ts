import {
  RequirementMatch,
  RequirementMatchLevel,
  ScreeningStatus,
} from '../../../core/ai-screenings';
import {
  ApplicantParam,
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
  RATING_HIGH = 'rating-desc',
  RATING_LOW = 'rating-asc',
  NEWEST = 'newest',
  OLDEST = 'oldest',
  NAME_AZ = 'name-asc',
  NAME_ZA = 'name-desc',
  STAGE = 'stage',
}

export const SORT_LABEL: Record<SortOption, string> = {
  [SortOption.FIT_HIGH]: 'Fit score: high to low',
  [SortOption.FIT_LOW]: 'Fit score: low to high',
  [SortOption.RATING_HIGH]: 'Rating: high to low',
  [SortOption.RATING_LOW]: 'Rating: low to high',
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

/**
 * Whether the signed-in user has rated the applicant yet. "Awaiting" leaves
 * out rejected applicants, matching the dashboard's count.
 */
export enum ReviewFilter {
  ANY = 'any',
  UNRATED = 'unrated',
  RATED = 'rated',
}

export const REVIEW_LABEL: Record<ReviewFilter, string> = {
  [ReviewFilter.ANY]: 'Any',
  [ReviewFilter.UNRATED]: 'Awaiting my rating',
  [ReviewFilter.RATED]: 'Rated by me',
};

/** Everything the search toolbar sets. `null` means "all". */
export type ApplicantQuery = {
  text: string;
  postingId: number | null;
  stage: KanbanStage | null;
  applied: AppliedWithin;
  resume: ResumeFilter;
  review: ReviewFilter;
  /** Only postings the signed-in recruiter is assigned to. */
  assignedOnly: boolean;
  sort: SortOption;
  thenBy: SortOption | null;
};

export const DEFAULT_QUERY: ApplicantQuery = {
  text: '',
  postingId: null,
  stage: null,
  applied: AppliedWithin.ANY,
  resume: ResumeFilter.ANY,
  review: ReviewFilter.ANY,
  assignedOnly: false,
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
    query.review !== ReviewFilter.ANY,
    query.assignedOnly,
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

/**
 * The posting, stage, applied date, resume, and review filters.
 * `assigned` is the signed-in recruiter's posting ids, for "My postings";
 * leave it out (or null) when it isn't known.
 */
export function matchesFilters(
  row: ApplicationRow,
  query: ApplicantQuery,
  now: Date,
  assigned: ReadonlySet<number> | null = null,
): boolean {
  if (query.postingId !== null && row.job_posting_id !== query.postingId) {
    return false;
  }
  if (query.assignedOnly && assigned && !assigned.has(row.job_posting_id)) {
    return false;
  }
  if (
    query.review === ReviewFilter.UNRATED &&
    (row.my_rating !== null || row.kanban_stage === KanbanStage.REJECTED)
  ) {
    return false;
  }
  if (query.review === ReviewFilter.RATED && row.my_rating === null) {
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
  assigned: ReadonlySet<number> | null = null,
): boolean {
  return (
    matchesFilters(row, query, now, assigned) && matchesText(row, query.text)
  );
}

/** Something with `get`, like Angular's ParamMap. */
type Params = { get(name: string): string | null };

const enumValue = <T extends string>(
  values: readonly T[],
  value: string | null,
): T | null => values.find((v: T) => v === value) ?? null;

/**
 * The filters a link asked for (see ApplicantParam), on top of `base`.
 * Unknown or broken values are ignored. Returns null when the link sets no
 * filters, so the page keeps whatever the user picked.
 */
export function queryFromParams(
  params: Params,
  base: ApplicantQuery = DEFAULT_QUERY,
): ApplicantQuery | null {
  const raw = Object.values(ApplicantParam).map((p: ApplicantParam) =>
    params.get(p),
  );
  if (raw.every((v: string | null) => v === null)) return null;

  const posting = Number(params.get(ApplicantParam.POSTING));
  const applied = enumValue(
    Object.values(AppliedWithin).filter((a) => a !== AppliedWithin.ANY),
    params.get(ApplicantParam.APPLIED),
  );
  const review = enumValue(
    [ReviewFilter.UNRATED, ReviewFilter.RATED],
    params.get(ApplicantParam.REVIEW),
  );
  return {
    ...clearFilters(base),
    postingId: Number.isInteger(posting) && posting > 0 ? posting : null,
    stage: enumValue(KANBAN_STAGES, params.get(ApplicantParam.STAGE)),
    applied: applied ?? AppliedWithin.ANY,
    review: review ?? ReviewFilter.ANY,
    assignedOnly: params.get(ApplicantParam.MINE) === '1',
  };
}

/** A stable key for the filter params, to tell when a new link arrives. */
export function filterParamsKey(params: Params): string {
  return Object.values(ApplicantParam)
    .map((p: ApplicantParam) => `${p}=${params.get(p) ?? ''}`)
    .join('&');
}

type Compare = (a: ApplicationRow, b: ApplicationRow) => number;

/** Only a finished screening has a score to sort by. */
function fitScore(row: ApplicationRow): number | null {
  const s = row.screening;
  return s?.status === ScreeningStatus.COMPLETED ? s.fit_score : null;
}

/** Compares values either way, always keeping missing ones last. */
function nullsLast(
  value: (row: ApplicationRow) => number | null,
  direction: 1 | -1,
): Compare {
  return (a: ApplicationRow, b: ApplicationRow) => {
    const x = value(a);
    const y = value(b);
    if (x === null || y === null)
      return Number(x === null) - Number(y === null);
    return (x - y) * direction;
  };
}

/** Unscored applicants always go last. */
const byFit = (direction: 1 | -1): Compare => nullsLast(fitScore, direction);

/** Unrated applicants always go last. */
const byRating = (direction: 1 | -1): Compare =>
  nullsLast((row: ApplicationRow) => row.rating.average, direction);

const byDate: Compare = (a: ApplicationRow, b: ApplicationRow) =>
  a.submitted_at.localeCompare(b.submitted_at);

const byName: Compare = (a: ApplicationRow, b: ApplicationRow) =>
  a.full_name.localeCompare(b.full_name, undefined, { sensitivity: 'base' });

const byStage: Compare = (a: ApplicationRow, b: ApplicationRow) =>
  KANBAN_STAGES.indexOf(a.kanban_stage) - KANBAN_STAGES.indexOf(b.kanban_stage);

const COMPARE: Record<SortOption, Compare> = {
  [SortOption.FIT_HIGH]: byFit(-1),
  [SortOption.FIT_LOW]: byFit(1),
  [SortOption.RATING_HIGH]: byRating(-1),
  [SortOption.RATING_LOW]: byRating(1),
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
