import { and, count, eq, inArray } from 'drizzle-orm';
import type { Database } from '../database/database.module.js';
import { applicationNotes, applicationRatings } from '../database/schema.js';

/**
 * How many notes each application has, in one query. Pass ids to read only
 * those. Applications without notes are not in the map.
 */
export async function noteCounts(
  db: Database,
  applicationIds?: readonly number[],
): Promise<Map<number, number>> {
  if (applicationIds?.length === 0) return new Map();
  const rows = await db
    .select({ application_id: applicationNotes.application_id, count: count() })
    .from(applicationNotes)
    .where(
      applicationIds
        ? inArray(applicationNotes.application_id, [...applicationIds])
        : undefined,
    )
    .groupBy(applicationNotes.application_id);
  return new Map(rows.map((r) => [r.application_id, r.count]));
}

/**
 * The stars one user gave, by application. Pass ids to read only those.
 * Applications they haven't rated are not in the map.
 */
export async function userRatings(
  db: Database,
  userId: number,
  applicationIds?: readonly number[],
): Promise<Map<number, number>> {
  if (applicationIds?.length === 0) return new Map();
  const rows = await db
    .select({
      application_id: applicationRatings.application_id,
      rating: applicationRatings.rating,
    })
    .from(applicationRatings)
    .where(
      and(
        eq(applicationRatings.user_id, userId),
        applicationIds
          ? inArray(applicationRatings.application_id, [...applicationIds])
          : undefined,
      ),
    );
  return new Map(rows.map((r) => [r.application_id, r.rating]));
}
