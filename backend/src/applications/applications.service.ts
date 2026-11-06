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

/** One row of GET /api/applications. */
export type ApplicationListItem = {
  id: number;
  job_posting_id: number;
  posting_title: string;
  full_name: string;
  email: string;
  kanban_stage: KanbanStage;
  submitted_at: Date;
  /** False until the resume upload finishes; screening needs it. */
  has_resume: boolean;
  /** Null until the resume has been screened. */
  screening: AiScreening | null;
};

@Injectable()
export class ApplicationsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly config: ConfigService,
  ) {}

  /** Every application, newest first, for the staff Applications page. */
  async list(): Promise<ApplicationListItem[]> {
    const rows = await this.db.query.applications.findMany({
      columns: {
        id: true,
        job_posting_id: true,
        kanban_stage: true,
        submitted_at: true,
      },
      with: {
        posting: { columns: { title: true } },
        profile: { columns: { full_name: true, email: true } },
        resume: { columns: { id: true } },
        screening: true,
      },
      orderBy: [desc(applications.submitted_at), desc(applications.id)],
    });
    // Applying saves the profile in the same transaction, so every row has one.
    return rows.flatMap(({ posting, profile, resume, screening, ...row }) =>
      profile
        ? [
            {
              ...row,
              posting_title: posting.title,
              full_name: profile.full_name,
              email: profile.email,
              has_resume: resume !== null,
              screening: screening ?? null,
            },
          ]
        : [],
    );
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
