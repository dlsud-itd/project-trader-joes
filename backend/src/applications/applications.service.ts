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
  ) {}

  /** Every application, newest first, for the staff Applications page. */
  async list(): Promise<ApplicationListItem[]> {
    const rows = await this.db.query.applications.findMany({
      ...listQuery,
      orderBy: [desc(applications.submitted_at), desc(applications.id)],
    });
    return rows.flatMap((row) => {
      const item = toListItem(row);
      return item ? [item] : [];
    });
  }

  /** One application, for the applicant profile page. */
  async findOne(id: number): Promise<ApplicationListItem> {
    const row = await this.db.query.applications.findFirst({
      ...listQuery,
      where: eq(applications.id, id),
    });
    const item = row && toListItem(row);
    if (!item) throw new NotFoundException('Application not found.');
    return item;
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
> & {
  posting: { title: string };
  profile: Pick<
    ApplicationListItem,
    'full_name' | 'email' | 'phone' | 'portfolio_url' | 'cover_note'
  > | null;
  resume: ApplicationListItem['resume'] | undefined;
  screening: AiScreening | null | undefined;
};

function toListItem({
  posting,
  profile,
  resume,
  screening,
  ...row
}: ListRow): ApplicationListItem | null {
  // Applying saves the profile in the same transaction, so every row has one.
  if (!profile) return null;
  return {
    ...row,
    posting_title: posting.title,
    ...profile,
    resume: resume ?? null,
    screening: screening ?? null,
  };
}
