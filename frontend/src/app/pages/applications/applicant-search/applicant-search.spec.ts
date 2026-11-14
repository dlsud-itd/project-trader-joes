import { ApplicationRow, KanbanStage } from '../../../core/applications';
import { TEST_APPLICATIONS } from '../test-applications';
import {
  activeFilterCount,
  ApplicantQuery,
  AppliedWithin,
  clearFilters,
  DEFAULT_QUERY,
  matchesQuery,
  matchesText,
  normalize,
  postingOptions,
  ResumeFilter,
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
