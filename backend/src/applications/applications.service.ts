import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq } from 'drizzle-orm';
import { DB, type Database } from '../database/database.module.js';
import {
  type AiScreening,
  applicantProfiles,
  applications,
  jobPostings,
  type KanbanStage,
} from '../database/schema.js';
import type { CreateApplicationDto } from './dto/create-application.dto.js';
import { signUploadToken } from '../common/upload-token/upload-token.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  NO_RATINGS,
  type RatingAverage,
  ratingAverages,
} from '../reviews/rating-averages.js';
import { noteCounts, userRatings } from '../reviews/review-counts.js';

/** One application in GET /api/applications and /api/applications/:id. */
export type ApplicationListItem = {
  id: number;
  job_posting_id: number;
  posting_title: string;
  full_name: string;
  email: string;
  phone: string | null;
  portfolio_url: string | null;
  cover_note: string | null;
  kanban_stage: KanbanStage;
  submitted_at: Date;
  /**
   * The uploaded file, without its bytes (download it from
   * /api/resumes/:id/file). Null until the upload finishes.
   */
  resume: {
    id: number;
    file_name: string;
    size_bytes: number;
    uploaded_at: Date;
  } | null;
  /** Null until the resume has been screened. */
  screening: AiScreening | null;
  /** The team's average star rating; `average` is null until someone rates. */
  rating: RatingAverage;
  /** The signed-in user's own stars; null if they haven't rated. */
  my_rating: number | null;
  /** How many shared notes the team has left. */
  note_count: number;
};

/** What the review lookups found, keyed by application id. */
type ReviewMaps = {
  averages: Map<number, RatingAverage>;
  mine: Map<number, number>;
  notes: Map<number, number>;
};

/** What to read for each application, shared by the list and one-item views. */
const listQuery = {
  columns: {
    id: true,
    job_posting_id: true,
    kanban_stage: true,
    submitted_at: true,
  },
  with: {
    posting: { columns: { title: true } },
    profile: {
      columns: {
        full_name: true,
        email: true,
        phone: true,
        portfolio_url: true,
        cover_note: true,
      },
    },
    resume: {
      columns: {
        id: true,
        file_name: true,
        size_bytes: true,
        uploaded_at: true,
      },
    },
    screening: true,
  },
} as const;

@Injectable()
export class ApplicationsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Every application, newest first, for the staff Applications page.
   * `my_rating` is the signed-in user's own rating.
   */
  async list(userId: number): Promise<ApplicationListItem[]> {
    const [rows, reviews] = await Promise.all([
      this.db.query.applications.findMany({
        ...listQuery,
        orderBy: [desc(applications.submitted_at), desc(applications.id)],
      }),
      this.reviewMaps(userId),
    ]);
    return rows.flatMap((row) => {
      const item = toListItem(row, reviews);
      return item ? [item] : [];
    });
  }

  /** One application, for the applicant profile page. */
  async findOne(id: number, userId: number): Promise<ApplicationListItem> {
    const [row, reviews] = await Promise.all([
      this.db.query.applications.findFirst({
        ...listQuery,
        where: eq(applications.id, id),
      }),
      this.reviewMaps(userId, [id]),
    ]);
    const item = row && toListItem(row, reviews);
    if (!item) throw new NotFoundException('Application not found.');
    return item;
  }

  /** Ratings and note counts, one query each, for all or some applications. */
  private async reviewMaps(
    userId: number,
    ids?: readonly number[],
  ): Promise<ReviewMaps> {
    const [averages, mine, notes] = await Promise.all([
      ratingAverages(this.db, ids),
      userRatings(this.db, userId, ids),
      noteCounts(this.db, ids),
    ]);
    return { averages, mine, notes };
  }

  /**
   * Moves an application to another pipeline stage (API spec IV.B), and
   * emails the applicant when it moves to Interview, Offer, or Rejected.
   */
  async updateStage(id: number, kanban_stage: KanbanStage) {
    const current = await this.db.query.applications.findFirst({
      where: eq(applications.id, id),
      columns: { kanban_stage: true },
    });
    if (!current) throw new NotFoundException('Application not found.');

    const [updated] = await this.db
      .update(applications)
      .set({ kanban_stage })
      .where(eq(applications.id, id))
      .returning({
        id: applications.id,
        kanban_stage: applications.kanban_stage,
        updated_at: applications.updated_at,
      });
    if (!updated) throw new NotFoundException('Application not found.');
    // Saving the same stage again must not email the applicant twice.
    if (current.kanban_stage !== kanban_stage) {
      void this.notifications.stageChanged(id, kanban_stage);
    }
    return updated;
  }

  /**
   * Saves the application and the candidate's profile together, so there is
   * never an application without contact details.
   */
  async submit({ job_posting_id, ...profile }: CreateApplicationDto) {
    const posting = await this.db.query.jobPostings.findFirst({
      where: eq(jobPostings.id, job_posting_id),
      columns: { id: true, status: true },
    });
    if (!posting) throw new NotFoundException('Job posting not found.');
    if (posting.status !== 'open') {
      throw new BadRequestException(
        'This position is no longer accepting applications.',
      );
    }

    const [duplicate] = await this.db
      .select({ id: applications.id })
      .from(applications)
      .innerJoin(
        applicantProfiles,
        eq(applicantProfiles.application_id, applications.id),
      )
      .where(
        and(
          eq(applications.job_posting_id, job_posting_id),
          eq(applicantProfiles.email, profile.email),
        ),
      )
      .limit(1);
    if (duplicate) {
      throw new ConflictException(
        'You have already applied for this position with this email.',
      );
    }

    const application = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(applications)
        .values({ job_posting_id })
        .returning({
          id: applications.id,
          job_posting_id: applications.job_posting_id,
          kanban_stage: applications.kanban_stage,
          submitted_at: applications.submitted_at,
        });
      await tx
        .insert(applicantProfiles)
        .values({ application_id: created.id, ...profile });
      return created;
    });
    void this.notifications.applicationReceived(application.id);

    return {
      application,
      upload_token: signUploadToken(
        application.id,
        this.config.getOrThrow<string>('JWT_SECRET'),
      ),
    };
  }
}

/** An application as read with `listQuery`. */
type ListRow = Omit<
  ApplicationListItem,
  | 'posting_title'
  | 'full_name'
  | 'email'
  | 'phone'
  | 'portfolio_url'
  | 'cover_note'
  | 'resume'
  | 'screening'
  | 'rating'
  | 'my_rating'
  | 'note_count'
> & {
  posting: { title: string };
  profile: Pick<
    ApplicationListItem,
    'full_name' | 'email' | 'phone' | 'portfolio_url' | 'cover_note'
  > | null;
  resume: ApplicationListItem['resume'] | undefined;
  screening: AiScreening | null | undefined;
};

function toListItem(
  { posting, profile, resume, screening, ...row }: ListRow,
  { averages, mine, notes }: ReviewMaps,
): ApplicationListItem | null {
  // Applying saves the profile in the same transaction, so every row has one.
  if (!profile) return null;
  return {
    ...row,
    posting_title: posting.title,
    ...profile,
    resume: resume ?? null,
    screening: screening ?? null,
    rating: averages.get(row.id) ?? NO_RATINGS,
    my_rating: mine.get(row.id) ?? null,
    note_count: notes.get(row.id) ?? 0,
  };
}
