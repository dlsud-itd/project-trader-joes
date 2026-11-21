import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  count,
  eq,
  inArray,
  isNull,
  ne,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { AuthUser } from '../common/types/auth-user.js';
import { DB, type Database } from '../database/database.module.js';
import {
  applicationRatings,
  applications,
  jobAssignments,
  jobPostings,
} from '../database/schema.js';
import {
  buildSummary,
  type DashboardSummary,
  NEW_WINDOW_DAYS,
} from './dashboard-summary.js';

/**
 * Recruiter dashboard numbers (WBS 4.5.4.1). Managers see every posting;
 * recruiters only see the postings they are assigned to.
 */
@Injectable()
export class DashboardService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async summary(user: AuthUser): Promise<DashboardSummary> {
    const isManager = user.role === 'manager';
    const scope = isManager ? 'all' : 'assigned';
    const postingIds = isManager
      ? null
      : await this.assignedPostingIds(user.id);

    // A recruiter with no assignments sees zeros, not everyone's numbers.
    if (postingIds?.length === 0) {
      return buildSummary({
        scope,
        postings: [],
        stageRows: [],
        awaitingYourRating: 0,
      });
    }

    const inScope = (column: typeof applications.job_posting_id) =>
      postingIds ? inArray(column, postingIds) : undefined;

    const [postings, stageRows, awaitingYourRating] = await Promise.all([
      this.db
        .select({
          id: jobPostings.id,
          title: jobPostings.title,
          department: jobPostings.department,
          status: jobPostings.status,
        })
        .from(jobPostings)
        .where(postingIds ? inArray(jobPostings.id, postingIds) : undefined),
      this.stageCounts(inScope(applications.job_posting_id)),
      this.awaitingRating(user.id, inScope(applications.job_posting_id)),
    ]);

    return buildSummary({ scope, postings, stageRows, awaitingYourRating });
  }

  private async assignedPostingIds(userId: number): Promise<number[]> {
    const rows = await this.db
      .select({ id: jobAssignments.job_posting_id })
      .from(jobAssignments)
      .where(eq(jobAssignments.user_id, userId));
    return rows.map((r) => r.id);
  }

  /** Applicants per posting and stage, and how many applied this week. */
  private stageCounts(where: SQL | undefined) {
    const since = sql.raw(`now() - interval '${NEW_WINDOW_DAYS} days'`);
    return this.db
      .select({
        job_posting_id: applications.job_posting_id,
        kanban_stage: applications.kanban_stage,
        count: count(),
        new_count:
          sql<number>`count(*) filter (where ${applications.submitted_at} >= ${since})`.mapWith(
            Number,
          ),
      })
      .from(applications)
      .where(where)
      .groupBy(applications.job_posting_id, applications.kanban_stage);
  }

  /** Applicants still in the running that this user hasn't rated. */
  private async awaitingRating(
    userId: number,
    where: SQL | undefined,
  ): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(applications)
      .leftJoin(
        applicationRatings,
        and(
          eq(applicationRatings.application_id, applications.id),
          eq(applicationRatings.user_id, userId),
        ),
      )
      .where(
        and(
          where,
          ne(applications.kanban_stage, 'Rejected'),
          isNull(applicationRatings.id),
        ),
      );
    return row?.count ?? 0;
  }
}
