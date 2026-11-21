import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { AuthUser } from '../common/types/auth-user.js';
import { DB, type Database } from '../database/database.module.js';
import {
  applicationNotes,
  applicationRatings,
  applications,
  jobAssignments,
  users,
} from '../database/schema.js';
import {
  NO_RATINGS,
  type RatingAverage,
  ratingAverages,
} from './rating-averages.js';

export const APPLICATION_NOT_FOUND = 'Application not found.';
export const NOTE_NOT_FOUND = 'Note not found.';
export const DELETE_NOT_ALLOWED_MESSAGE =
  'Only the note’s author or a manager can delete it.';
export const NOT_ALLOWED_MESSAGE =
  'Only managers and recruiters assigned to this posting can add notes ' +
  'and ratings.';

/** One note in GET /api/applications/:id/notes, with who wrote it. */
export type NoteItem = {
  id: number;
  application_id: number;
  body: string;
  created_at: Date;
  author: { id: number; first_name: string; last_name: string };
};

/** GET /api/applications/:id/rating, also returned after rating. */
export type RatingSummary = RatingAverage & {
  /** The signed-in user's own rating; null if they haven't rated. */
  my_rating: number | null;
  /** Whether the signed-in user may add notes and ratings here. */
  can_review: boolean;
};

const noteColumns = {
  id: applicationNotes.id,
  application_id: applicationNotes.application_id,
  body: applicationNotes.body,
  created_at: applicationNotes.created_at,
  author: {
    id: users.id,
    first_name: users.first_name,
    last_name: users.last_name,
  },
};

/**
 * Shared notes and 1–5 star ratings on applications (WBS 4.5.2.2).
 * All staff can read them; managers and recruiters assigned to the
 * application's posting can add them.
 */
@Injectable()
export class ReviewsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Every note on the application, newest first. */
  async listNotes(applicationId: number): Promise<NoteItem[]> {
    await this.postingOf(applicationId);
    return this.db
      .select(noteColumns)
      .from(applicationNotes)
      .innerJoin(users, eq(users.id, applicationNotes.author_id))
      .where(eq(applicationNotes.application_id, applicationId))
      .orderBy(desc(applicationNotes.created_at), desc(applicationNotes.id));
  }

  /** Saves a note written by the signed-in user. */
  async addNote(
    user: AuthUser,
    applicationId: number,
    body: string,
  ): Promise<NoteItem> {
    await this.assertCanReview(user, applicationId);
    const [created] = await this.db
      .insert(applicationNotes)
      .values({ application_id: applicationId, author_id: user.id, body })
      .returning({ id: applicationNotes.id });
    const [note] = await this.db
      .select(noteColumns)
      .from(applicationNotes)
      .innerJoin(users, eq(users.id, applicationNotes.author_id))
      .where(eq(applicationNotes.id, created.id));
    return note;
  }

  /**
   * Deletes a note. Authors can take back their own notes; managers can
   * remove any note, e.g. one left on the wrong applicant.
   */
  async deleteNote(
    user: AuthUser,
    applicationId: number,
    noteId: number,
  ): Promise<void> {
    await this.postingOf(applicationId);
    const note = await this.db.query.applicationNotes.findFirst({
      where: and(
        eq(applicationNotes.id, noteId),
        eq(applicationNotes.application_id, applicationId),
      ),
      columns: { author_id: true },
    });
    if (!note) throw new NotFoundException(NOTE_NOT_FOUND);
    if (user.role !== 'manager' && note.author_id !== user.id) {
      throw new ForbiddenException(DELETE_NOT_ALLOWED_MESSAGE);
    }
    await this.db
      .delete(applicationNotes)
      .where(eq(applicationNotes.id, noteId));
  }

  /** The average, how many rated, and the signed-in user's own rating. */
  async getRating(
    user: AuthUser,
    applicationId: number,
  ): Promise<RatingSummary> {
    const postingId = await this.postingOf(applicationId);
    return this.summary(user, applicationId, postingId);
  }

  /** Sets the signed-in user's rating, replacing any earlier one. */
  async setRating(
    user: AuthUser,
    applicationId: number,
    rating: number,
  ): Promise<RatingSummary> {
    const postingId = await this.assertCanReview(user, applicationId);
    await this.db
      .insert(applicationRatings)
      .values({ application_id: applicationId, user_id: user.id, rating })
      .onConflictDoUpdate({
        target: [applicationRatings.application_id, applicationRatings.user_id],
        set: { rating, updated_at: new Date() },
      });
    return this.summary(user, applicationId, postingId);
  }

  /** Removes the signed-in user's rating. Does nothing if they had none. */
  async removeRating(
    user: AuthUser,
    applicationId: number,
  ): Promise<RatingSummary> {
    const postingId = await this.assertCanReview(user, applicationId);
    await this.db
      .delete(applicationRatings)
      .where(
        and(
          eq(applicationRatings.application_id, applicationId),
          eq(applicationRatings.user_id, user.id),
        ),
      );
    return this.summary(user, applicationId, postingId);
  }

  private async summary(
    user: AuthUser,
    applicationId: number,
    postingId: number,
  ): Promise<RatingSummary> {
    const [averages, mine, canReview] = await Promise.all([
      ratingAverages(this.db, [applicationId]),
      this.db.query.applicationRatings.findFirst({
        where: and(
          eq(applicationRatings.application_id, applicationId),
          eq(applicationRatings.user_id, user.id),
        ),
        columns: { rating: true },
      }),
      this.canReview(user, postingId),
    ]);
    return {
      ...(averages.get(applicationId) ?? NO_RATINGS),
      my_rating: mine?.rating ?? null,
      can_review: canReview,
    };
  }

  /** The application's posting id; 404 when the application doesn't exist. */
  private async postingOf(applicationId: number): Promise<number> {
    const row = await this.db.query.applications.findFirst({
      where: eq(applications.id, applicationId),
      columns: { job_posting_id: true },
    });
    if (!row) throw new NotFoundException(APPLICATION_NOT_FOUND);
    return row.job_posting_id;
  }

  /** Managers always; recruiters only on postings they are assigned to. */
  private async canReview(user: AuthUser, postingId: number): Promise<boolean> {
    if (user.role === 'manager') return true;
    if (user.role !== 'recruiter') return false;
    const assignment = await this.db.query.jobAssignments.findFirst({
      where: and(
        eq(jobAssignments.job_posting_id, postingId),
        eq(jobAssignments.user_id, user.id),
      ),
      columns: { id: true },
    });
    return assignment !== undefined;
  }

  /** Returns the posting id, or throws 404 / 403. */
  private async assertCanReview(
    user: AuthUser,
    applicationId: number,
  ): Promise<number> {
    const postingId = await this.postingOf(applicationId);
    if (!(await this.canReview(user, postingId))) {
      throw new ForbiddenException(NOT_ALLOWED_MESSAGE);
    }
    return postingId;
  }
}
