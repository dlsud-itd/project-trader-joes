/** Longest note the API accepts, in characters. */
export const NOTE_MAX_LENGTH = 2000;
/** Ratings are whole stars from 1 to RATING_MAX. */
export const RATING_MAX = 5;

/** The team's rating, as sent with every application. */
export type RatingAverage = {
  /** Rounded to one decimal; null until someone rates. */
  average: number | null;
  count: number;
};

/** GET /api/applications/:id/rating, also returned after rating. */
export type RatingSummary = RatingAverage & {
  /** Your own rating; null if you haven't rated. */
  my_rating: number | null;
  /** Whether you may add notes and ratings on this applicant. */
  can_review: boolean;
};

/** Who wrote a note. */
export type NoteAuthor = {
  id: number;
  first_name: string;
  last_name: string;
};

/** One note in GET /api/applications/:id/notes. */
export type Note = {
  id: number;
  application_id: number;
  body: string;
  created_at: string;
  author: NoteAuthor;
};

/** Response body of POST /api/applications/:id/notes. */
export type NoteResponse = { message: string; note: Note };

/** Response body of PUT and DELETE /api/applications/:id/rating. */
export type RatingResponse = { message: string; rating: RatingSummary };

/**
 * The average after you change your own rating, worked out before the
 * server answers so the stars update at once. `next` null removes yours.
 */
export function withMyRating(
  summary: RatingSummary,
  next: number | null,
): RatingSummary {
  const previous = summary.my_rating;
  const total = (summary.average ?? 0) * summary.count - (previous ?? 0);
  const count =
    summary.count - (previous === null ? 0 : 1) + (next === null ? 0 : 1);
  const average =
    count === 0 ? null : Math.round(((total + (next ?? 0)) / count) * 10) / 10;
  return { ...summary, average, count, my_rating: next };
}

/** "3.5 out of 5 from 2 ratings", for screen readers and tooltips. */
export function ratingLabel({ average, count }: RatingAverage): string {
  if (average === null) return 'Not rated yet';
  const people = count === 1 ? '1 rating' : `${count} ratings`;
  return `${average} out of ${RATING_MAX} from ${people}`;
}
