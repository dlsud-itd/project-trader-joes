import { ApplicationRow, KanbanStage } from '../../../core/applications';
import { TEST_APPLICATIONS } from '../test-applications';
import {
  activeFilterCount,
  ApplicantQuery,
  AppliedWithin,
  clearFilters,
  DEFAULT_QUERY,
  filterParamsKey,
  matchesQuery,
  matchesText,
  normalize,
  postingOptions,
  queryFromParams,
  ResumeFilter,
  ReviewFilter,
  SortOption,
  sortApplications,
} from './applicant-search';

/** A day after the newest test application (Hana, Oct 31). */
const NOW = new Date('2026-11-01T03:30:00Z');

const byName = (name: string) =>
  TEST_APPLICATIONS.find(
    (r: ApplicationRow) => r.full_name === name,
  ) as ApplicationRow;

const names = (rows: ApplicationRow[]) =>
  rows.map((r: ApplicationRow) => r.full_name);

/** Names of the test applicants matching the query, in list order. */
const found = (patch: Partial<ApplicantQuery>) =>
  names(
    TEST_APPLICATIONS.filter((r: ApplicationRow) =>
      matchesQuery(r, { ...DEFAULT_QUERY, ...patch }, NOW),
    ),
  );

describe('normalize', () => {
  it('lowercases and drops accents', () => {
    expect(normalize('Peña ÁLVAREZ')).toBe('pena alvarez');
  });
});

describe('matchesText', () => {
  const mei = byName('Mei-Lin Chen');

  it('matches the name, email, posting, and cover note', () => {
    expect(matchesText(mei, 'mei-lin')).toBe(true);
    expect(matchesText(mei, mei.email.toUpperCase())).toBe(true);
    expect(matchesText(mei, 'frontend intern')).toBe(true);
    expect(matchesText(mei, 'shipped angular')).toBe(true);
  });

  it('needs every word, in any order', () => {
    expect(matchesText(mei, 'chen mei')).toBe(true);
    expect(matchesText(mei, 'chen okafor')).toBe(false);
  });

  it('matches a phone number with or without spaces', () => {
    expect(matchesText(mei, '917 555')).toBe(true);
    expect(matchesText(mei, '9175550101')).toBe(true);
  });

  it('matches skills the AI found, but not missing ones', () => {
    const aisha = byName('Aisha Rahman');
    expect(matchesText(aisha, 'typescript')).toBe(true);
    expect(matchesText(aisha, 'unit testing')).toBe(false);
  });

  it('matches everyone when the search is blank', () => {
    expect(matchesText(mei, '   ')).toBe(true);
  });
});

describe('matchesQuery filters', () => {
  it('filters by posting id', () => {
    expect(found({ postingId: 2 })).toEqual([
      'Kenji Watanabe',
      'Sofia Alvarez',
      'Daniel Okafor',
    ]);
  });

  it('filters by stage', () => {
    expect(found({ stage: KanbanStage.SCREENING })).toEqual([
      'Mei-Lin Chen',
      'Kenji Watanabe',
      'Sofia Alvarez',
    ]);
  });

  it('filters by how recently they applied', () => {
    expect(found({ applied: AppliedWithin.DAY })).toEqual(['Hana Kim']);
    expect(found({ applied: AppliedWithin.WEEK })).toEqual(['Hana Kim']);
    expect(found({ applied: AppliedWithin.MONTH })).toHaveLength(
      TEST_APPLICATIONS.length,
    );
  });

  it('filters by whether a resume was uploaded', () => {
    const missing = found({ resume: ResumeFilter.WITHOUT });
    expect(missing).toEqual(['Hana Kim']);
    expect(found({ resume: ResumeFilter.WITH })).not.toContain('Hana Kim');
  });

  it('combines search and filters', () => {
    expect(found({ text: 'qa', stage: KanbanStage.REJECTED })).toEqual([
      'Daniel Okafor',
    ]);
  });
});

describe('sortApplications', () => {
  it('sorts by fit score with unscored applicants last either way', () => {
    const high = names(
      sortApplications(TEST_APPLICATIONS, [SortOption.FIT_HIGH]),
    );
    const low = names(
      sortApplications(TEST_APPLICATIONS, [SortOption.FIT_LOW]),
    );
    expect(high.slice(0, 2)).toEqual(['Mei-Lin Chen', 'Jonah Reyes']);
    expect(high.slice(-2).sort()).toEqual(['Hana Kim', 'Lucas Martin']);
    expect(low.slice(-2).sort()).toEqual(['Hana Kim', 'Lucas Martin']);
    expect(low[0]).toBe('Daniel Okafor');
  });

  it('sorts by team rating with unrated applicants last either way', () => {
    const rated = ['Mei-Lin Chen', 'Aisha Rahman', 'Jonah Reyes'];
    const high = names(
      sortApplications(TEST_APPLICATIONS, [SortOption.RATING_HIGH]),
    );
    const low = names(
      sortApplications(TEST_APPLICATIONS, [SortOption.RATING_LOW]),
    );
    expect(high.slice(0, 5)).toEqual([
      ...rated,
      'Kenji Watanabe',
      'Daniel Okafor',
    ]);
    expect(low.slice(0, 5)).toEqual([
      'Daniel Okafor',
      'Kenji Watanabe',
      ...[...rated].reverse(),
    ]);
    const unrated = ['Hana Kim', 'Lucas Martin', 'Sofia Alvarez'];
    expect(high.slice(-3).sort()).toEqual(unrated);
    expect(low.slice(-3).sort()).toEqual(unrated);
  });

  it('sorts by date and by name', () => {
    expect(
      names(sortApplications(TEST_APPLICATIONS, [SortOption.NEWEST]))[0],
    ).toBe('Hana Kim');
    expect(
      names(sortApplications(TEST_APPLICATIONS, [SortOption.OLDEST]))[0],
    ).toBe('Daniel Okafor');
    expect(
      names(sortApplications(TEST_APPLICATIONS, [SortOption.NAME_AZ]))[0],
    ).toBe('Aisha Rahman');
    expect(
      names(sortApplications(TEST_APPLICATIONS, [SortOption.NAME_ZA]))[0],
    ).toBe('Sofia Alvarez');
  });

  it('breaks ties with the second sort', () => {
    const sorted = sortApplications(TEST_APPLICATIONS, [
      SortOption.STAGE,
      SortOption.NAME_AZ,
    ]);
    expect(names(sorted).slice(0, 3)).toEqual([
      'Hana Kim',
      'Jonah Reyes',
      'Lucas Martin',
    ]);
    expect(sorted.at(-1)?.kanban_stage).toBe(KanbanStage.REJECTED);
  });

  it('keeps a steady order when everything ties, and does not mutate', () => {
    const copy = [...TEST_APPLICATIONS];
    const sorted = sortApplications(TEST_APPLICATIONS, [null]);
    expect(sorted.map((r: ApplicationRow) => r.id)).toEqual(
      copy
        .map((r: ApplicationRow) => r.id)
        .sort((a: number, b: number) => a - b),
    );
    expect(TEST_APPLICATIONS).toEqual(copy);
  });
});

describe('query helpers', () => {
  it('lists each posting once, A to Z', () => {
    expect(postingOptions(TEST_APPLICATIONS)).toEqual([
      { id: 1, title: 'Frontend Developer Intern' },
      { id: 2, title: 'QA Analyst' },
    ]);
  });

  it('counts the filters in use and clears them but not the sort', () => {
    const query: ApplicantQuery = {
      ...DEFAULT_QUERY,
      text: 'mei',
      stage: KanbanStage.OFFER,
      sort: SortOption.NAME_AZ,
      thenBy: null,
    };
    expect(activeFilterCount(DEFAULT_QUERY)).toBe(0);
    expect(activeFilterCount(query)).toBe(2);
    expect(clearFilters(query)).toEqual({
      ...DEFAULT_QUERY,
      sort: SortOption.NAME_AZ,
      thenBy: null,
    });
  });
});

describe('review and "my postings" filters', () => {
  it('finds applicants awaiting my rating, leaving out rejected ones', () => {
    // Lucas, Hana, Jonah, Sofia unrated by me; Daniel is unrated but rejected.
    expect(found({ review: ReviewFilter.UNRATED }).sort()).toEqual([
      'Hana Kim',
      'Jonah Reyes',
      'Lucas Martin',
      'Sofia Alvarez',
    ]);
  });

  it('finds applicants I already rated', () => {
    expect(found({ review: ReviewFilter.RATED })).toEqual([
      'Mei-Lin Chen',
      'Aisha Rahman',
      'Kenji Watanabe',
    ]);
  });

  it('keeps only my assigned postings when "My postings" is on', () => {
    const qa = new Set([2]);
    const mine = TEST_APPLICATIONS.filter((r: ApplicationRow) =>
      matchesQuery(r, { ...DEFAULT_QUERY, assignedOnly: true }, NOW, qa),
    );
    expect(names(mine)).toEqual([
      'Kenji Watanabe',
      'Sofia Alvarez',
      'Daniel Okafor',
    ]);
  });

  it('ignores "My postings" until the assignments are known', () => {
    expect(found({ assignedOnly: true })).toHaveLength(
      TEST_APPLICATIONS.length,
    );
  });

  it('counts both as filters in use', () => {
    expect(
      activeFilterCount({
        ...DEFAULT_QUERY,
        review: ReviewFilter.UNRATED,
        assignedOnly: true,
      }),
    ).toBe(2);
  });
});

describe('queryFromParams', () => {
  const params = (values: Record<string, string>) => ({
    get: (name: string) => values[name] ?? null,
  });

  it('returns null when the link sets no filters', () => {
    expect(queryFromParams(params({ view: 'board' }))).toBeNull();
  });

  it('reads every filter a dashboard link can set', () => {
    expect(
      queryFromParams(
        params({
          posting: '2',
          stage: 'Interview',
          applied: '7',
          review: 'unrated',
          mine: '1',
        }),
      ),
    ).toEqual({
      ...DEFAULT_QUERY,
      postingId: 2,
      stage: KanbanStage.INTERVIEW,
      applied: AppliedWithin.WEEK,
      review: ReviewFilter.UNRATED,
      assignedOnly: true,
    });
  });

  it('replaces earlier filters and search text but keeps the sort', () => {
    const base: ApplicantQuery = {
      ...DEFAULT_QUERY,
      text: 'mei',
      resume: ResumeFilter.WITH,
      sort: SortOption.NAME_AZ,
    };
    expect(queryFromParams(params({ stage: 'Offer' }), base)).toEqual({
      ...DEFAULT_QUERY,
      stage: KanbanStage.OFFER,
      sort: SortOption.NAME_AZ,
    });
  });

  it('ignores values it does not recognise', () => {
    expect(
      queryFromParams(
        params({
          posting: 'abc',
          stage: 'Hired',
          applied: '365',
          review: 'maybe',
          mine: 'yes',
        }),
      ),
    ).toEqual(DEFAULT_QUERY);
    expect(queryFromParams(params({ posting: '-3' }))?.postingId).toBeNull();
  });

  it('builds a key that only changes with the filter params', () => {
    const a = filterParamsKey(params({ stage: 'Offer', view: 'board' }));
    const b = filterParamsKey(params({ stage: 'Offer' }));
    const c = filterParamsKey(params({ stage: 'Applied' }));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
