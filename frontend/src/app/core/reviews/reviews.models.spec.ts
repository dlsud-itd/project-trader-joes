import { RatingSummary, ratingLabel, withMyRating } from './reviews.models';
import { timeAgo } from './time-ago';

const summary = (over: Partial<RatingSummary> = {}): RatingSummary => ({
  average: null,
  count: 0,
  my_rating: null,
  can_review: true,
  ...over,
});

describe('withMyRating', () => {
  it('adds your first rating', () => {
    expect(withMyRating(summary(), 4)).toMatchObject({
      average: 4,
      count: 1,
      my_rating: 4,
    });
    expect(withMyRating(summary({ average: 2, count: 1 }), 5)).toMatchObject({
      average: 3.5,
      count: 2,
      my_rating: 5,
    });
  });

  it('changes your rating without counting you twice', () => {
    const before = summary({ average: 3.5, count: 2, my_rating: 5 });
    expect(withMyRating(before, 1)).toMatchObject({
      average: 1.5,
      count: 2,
      my_rating: 1,
    });
  });

  it('removes your rating', () => {
    expect(
      withMyRating(summary({ average: 3.5, count: 2, my_rating: 5 }), null),
    ).toMatchObject({ average: 2, count: 1, my_rating: null });
    expect(
      withMyRating(summary({ average: 4, count: 1, my_rating: 4 }), null),
    ).toMatchObject({ average: null, count: 0, my_rating: null });
  });

  it('rounds to one decimal like the server', () => {
    const before = summary({ average: 4.5, count: 2 });
    expect(withMyRating(before, 5).average).toBe(4.7);
  });
});

describe('ratingLabel', () => {
  it('reads out the average and how many rated', () => {
    expect(ratingLabel({ average: null, count: 0 })).toBe('Not rated yet');
    expect(ratingLabel({ average: 4, count: 1 })).toBe(
      '4 out of 5 from 1 rating',
    );
    expect(ratingLabel({ average: 3.5, count: 2 })).toBe(
      '3.5 out of 5 from 2 ratings',
    );
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-11-14T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const MIN = 60_000;

  it('says how long ago, then the date after a week', () => {
    expect(timeAgo(ago(20_000), now)).toBe('just now');
    expect(timeAgo(ago(MIN), now)).toBe('1 minute ago');
    expect(timeAgo(ago(5 * MIN), now)).toBe('5 minutes ago');
    expect(timeAgo(ago(2 * 60 * MIN), now)).toBe('2 hours ago');
    expect(timeAgo(ago(30 * 60 * MIN), now)).toBe('yesterday');
    expect(timeAgo(ago(3 * 24 * 60 * MIN), now)).toBe('3 days ago');
    expect(timeAgo('2026-10-21T02:10:00Z', now)).toBe('Oct 21, 2026');
  });

  it('treats a time slightly in the future as just now', () => {
    expect(timeAgo(ago(-5_000), now)).toBe('just now');
  });
});
