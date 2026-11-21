import {
  RequirementMatch,
  RequirementMatchLevel,
} from '../../../core/ai-screenings';
import { ApplicationRow } from '../../../core/applications';
import { TEST_APPLICATIONS } from '../test-applications';
import {
  bestFitIds,
  compareParam,
  parseCompareIds,
  pickRows,
  postingTitles,
  RequirementRow,
  requirementRows,
  sharedPosting,
} from './compare';

const byName = (name: string): ApplicationRow =>
  TEST_APPLICATIONS.find(
    (r: ApplicationRow) => r.full_name === name,
  ) as ApplicationRow;

describe('parseCompareIds', () => {
  it('reads ids, skipping junk and repeats', () => {
    expect(parseCompareIds('101, 102,abc,101,-3,0,1.5')).toEqual([101, 102]);
    expect(parseCompareIds(null)).toEqual([]);
    expect(parseCompareIds('')).toEqual([]);
  });

  it('keeps at most four', () => {
    expect(parseCompareIds('1,2,3,4,5')).toEqual([1, 2, 3, 4]);
  });
});

describe('compareParam', () => {
  it('joins ids, or drops the parameter when there are none', () => {
    expect(compareParam([101, 102])).toBe('101,102');
    expect(compareParam([])).toBeNull();
  });
});

describe('pickRows', () => {
  it('keeps the picked order and drops unknown ids', () => {
    const rows = pickRows(TEST_APPLICATIONS, [106, 999, 101]);
    expect(rows.map((r: ApplicationRow) => r.full_name)).toEqual([
      'Kenji Watanabe',
      'Mei-Lin Chen',
    ]);
  });
});

describe('bestFitIds', () => {
  it('marks every applicant tied for the top score', () => {
    const rows = [
      byName('Mei-Lin Chen'),
      byName('Jonah Reyes'),
      byName('Aisha Rahman'),
    ];
    expect([...bestFitIds(rows)]).toEqual([101, 102]);
  });

  it('marks no one when everyone ties', () => {
    // Mei-Lin and Jonah both score 90.
    const rows = [byName('Mei-Lin Chen'), byName('Jonah Reyes')];
    expect(bestFitIds(rows).size).toBe(0);
  });

  it('marks no one when the applicants applied to different jobs', () => {
    const rows = [byName('Mei-Lin Chen'), byName('Kenji Watanabe')];
    expect(bestFitIds(rows).size).toBe(0);
  });

  it('marks no one when fewer than two are scored', () => {
    const rows = [byName('Mei-Lin Chen'), byName('Hana Kim')];
    expect(bestFitIds(rows).size).toBe(0);
  });
});

describe('sharedPosting', () => {
  it('names the job when every applicant applied to it', () => {
    const rows = [byName('Mei-Lin Chen'), byName('Jonah Reyes')];
    expect(sharedPosting(rows)).toEqual({
      id: 1,
      title: 'Frontend Developer Intern',
    });
  });

  it('is null for mixed jobs or nobody', () => {
    const rows = [byName('Mei-Lin Chen'), byName('Kenji Watanabe')];
    expect(sharedPosting(rows)).toBeNull();
    expect(sharedPosting([])).toBeNull();
    expect(postingTitles(rows)).toEqual([
      'Frontend Developer Intern',
      'QA Analyst',
    ]);
  });
});

describe('requirementRows', () => {
  it('lists each requirement once with a match per applicant', () => {
    const rows = [byName('Kenji Watanabe'), byName('Sofia Alvarez')];
    const lines = requirementRows(rows);
    const ci = lines.find(
      (l: RequirementRow) => l.requirement === 'CI pipelines',
    );

    expect(ci?.matches.map((m: RequirementMatch | null) => m?.match)).toEqual([
      RequirementMatchLevel.MISSING,
      RequirementMatchLevel.PARTIAL,
    ]);
    expect(new Set(lines.map((l: RequirementRow) => l.requirement)).size).toBe(
      lines.length,
    );
  });

  it('leaves a gap for postings that did not list a requirement', () => {
    const rows = [byName('Mei-Lin Chen'), byName('Kenji Watanabe')];
    const ci = requirementRows(rows).find(
      (l: RequirementRow) => l.requirement === 'CI pipelines',
    );
    expect(ci?.matches[0]).toBeNull();
    expect(ci?.matches[1]?.match).toBe(RequirementMatchLevel.MISSING);
  });

  it('skips applicants that are not scored', () => {
    const lines = requirementRows([byName('Hana Kim'), byName('Lucas Martin')]);
    expect(lines).toEqual([]);
  });
});
