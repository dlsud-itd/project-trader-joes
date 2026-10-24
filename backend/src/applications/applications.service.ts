import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq } from 'drizzle-orm';
import { DB, type Database } from '../database/database.module.js';
import {
  applicantProfiles,
  applications,
  jobPostings,
} from '../database/schema.js';
import type { CreateApplicationDto } from './dto/create-application.dto.js';
import { signUploadToken } from '../common/upload-token/upload-token.js';

@Injectable()
export class ApplicationsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly config: ConfigService,
  ) {}

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