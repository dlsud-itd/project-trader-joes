import { count, inArray, sql } from 'drizzle-orm';
import type { Database } from '../database/database.module.js';
import { applicationRatings } from '../database/schema.js';

/** The team's rating of one application. */
export type RatingAverage = {
  /** Rounded to one decimal; null until someone rates. */
  average: number | null;
  /** How many people rated. */
  count: number;
};

export const NO_RATINGS: RatingAverage = { average: null, count: 0 };

/**
 * Average rating per application, in one query. Pass ids to read only those;
 * leave them out to read every application. Unrated ones are not in the map.
 */
export async function ratingAverages(
  db: Database,
  applicationIds?: readonly number[],
): Promise<Map<number, RatingAverage>> {
  if (applicationIds?.length === 0) return new Map();
  const rows = await db
    .select({
      application_id: applicationRatings.application_id,
      average: sql<string>`round(avg(${applicationRatings.rating}), 1)`,
      count: count(),
    })
    .from(applicationRatings)
    .where(
      applicationIds
        ? inArray(applicationRatings.application_id, [...applicationIds])
        : undefined,
    )
    .groupBy(applicationRatings.application_id);
  return new Map(
    rows.map((row) => [
      row.application_id,
      { average: Number(row.average), count: row.count },
    ]),
  );
}
