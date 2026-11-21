import {
  buildSummary,
  type PostingRow,
  type StageRow,
} from './dashboard-summary.js';

const NOW = new Date('2026-11-20T08:00:00Z');

const POSTINGS: PostingRow[] = [
  { id: 1, title: 'QA Analyst', department: 'IT', status: 'open' },
  { id: 2, title: 'Frontend Intern', department: 'IT', status: 'open' },
  { id: 3, title: 'Old Role', department: 'HR', status: 'closed' },
];

const row = (
  job_posting_id: number,
  kanban_stage: StageRow['kanban_stage'],
  count: number,
  new_count = 0,
): StageRow => ({ job_posting_id, kanban_stage, count, new_count });

describe('buildSummary', () => {
  it('adds up postings, candidates, and stages', () => {
    const summary = buildSummary({
      scope: 'all',
      postings: POSTINGS,
      stageRows: [
        row(1, 'Applied', 3, 2),
        row(1, 'Interview', 1),
        row(2, 'Applied', 2, 1),
        row(2, 'Rejected', 4),
        row(3, 'Offer', 1),
      ],
      awaitingYourRating: 5,
      now: NOW,
    });

    expect(summary.postings).toEqual({ open: 2, closed: 1, total: 3 });
    expect(summary.candidates).toEqual({
      total: 11,
      new_this_week: 3,
      awaiting_your_rating: 5,
    });
    expect(summary.stages).toEqual([
      { stage: 'Applied', count: 5 },
      { stage: 'Screening', count: 0 },
      { stage: 'Interview', count: 1 },
      { stage: 'Offer', count: 1 },
      { stage: 'Rejected', count: 4 },
    ]);
    expect(summary.generated_at).toBe(NOW.toISOString());
  });

  it('lists open postings first, busiest first, with active counts', () => {
    const { by_posting } = buildSummary({
      scope: 'all',
      postings: POSTINGS,
      stageRows: [
        row(1, 'Applied', 1),
        row(2, 'Applied', 2),
        row(2, 'Rejected', 4),
        row(3, 'Offer', 9),
      ],
      awaitingYourRating: 0,
    });

    expect(by_posting.map((p) => p.id)).toEqual([2, 1, 3]);
    expect(by_posting[0]).toMatchObject({ candidates: 6, active: 2 });
    expect(by_posting[0].stages).toEqual({
      Applied: 2,
      Screening: 0,
      Interview: 0,
      Offer: 0,
      Rejected: 4,
    });
  });

  it('ignores applicants on postings outside the scope', () => {
    const summary = buildSummary({
      scope: 'assigned',
      postings: [POSTINGS[0]],
      stageRows: [row(1, 'Screening', 2, 1), row(2, 'Applied', 7, 7)],
      awaitingYourRating: 2,
    });

    expect(summary.scope).toBe('assigned');
    expect(summary.postings).toEqual({ open: 1, closed: 0, total: 1 });
    expect(summary.candidates.total).toBe(2);
    expect(summary.candidates.new_this_week).toBe(1);
    expect(summary.by_posting).toHaveLength(1);
  });

  it('returns every stage at zero when there is nothing to count', () => {
    const summary = buildSummary({
      scope: 'assigned',
      postings: [],
      stageRows: [],
      awaitingYourRating: 0,
    });

    expect(summary.candidates.total).toBe(0);
    expect(summary.stages.map((s) => s.count)).toEqual([0, 0, 0, 0, 0]);
    expect(summary.by_posting).toEqual([]);
  });
});
