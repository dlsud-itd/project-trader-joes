import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Database } from '../database/database.module.js';
import { aiScreenings, applications } from '../database/schema.js';
import { ResumeTextService } from '../resumes/resume-text.service.js';
import { GeminiClient } from './gemini.client.js';
import { failureReason, MissingResumeTextError } from './screening-failure.js';
import {
  buildScreeningPrompt,
  SCREENING_RESPONSE_SCHEMA,
  SCREENING_SYSTEM_PROMPT,
  splitRequirements,
  type ScreeningPosting,
} from './screening-prompt.js';
import { ScreeningQueue } from './screening-queue.js';
import {
  parseScreeningResult,
  type ScreeningResult,
} from './screening-result.js';

@Injectable()
export class AiScreeningsService {
  private readonly logger = new Logger(AiScreeningsService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly gemini: GeminiClient,
    private readonly resumeText: ResumeTextService,
    private readonly queue: ScreeningQueue,
  ) {}

  /**
   * Scores the application's resume against its posting and saves the result.
   * A finished screening is returned as is unless `retry` is set.
   * Screenings wait their turn in the queue.
   */
  screen(applicationId: number, retry: boolean) {
    if (this.queue.size > 0) {
      this.logger.log(
        `Screening ${applicationId} waits behind ${this.queue.size}.`,
      );
    }
    return this.queue.run(() => this.process(applicationId, retry));
  }

  /** The saved screening for an application. */
  async findOne(applicationId: number) {
    const screening = await this.db.query.aiScreenings.findFirst({
      where: eq(aiScreenings.application_id, applicationId),
    });
    if (!screening) throw new NotFoundException('AI screening not found.');
    return screening;
  }

  private async process(applicationId: number, retry: boolean) {
    const application = await this.db.query.applications.findFirst({
      where: eq(applications.id, applicationId),
      columns: { id: true },
      with: {
        posting: {
          columns: { title: true, description: true, requirements: true },
        },
        resume: { columns: { id: true, extracted_text: true } },
        screening: true,
      },
    });
    if (!application) throw new NotFoundException('Application not found.');
    if (!application.resume) {
      throw new BadRequestException('Upload a resume before screening.');
    }

    const previous = application.screening;
    if (previous && !retry) {
      if (previous.status === 'completed') return previous;
      throw new ConflictException(
        'The last screening failed. Send "retry": true to try again.',
      );
    }
    const retry_count = previous ? previous.retry_count + 1 : 0;

    try {
      // Text missing from upload time (an old upload or a failed read) is
      // read again here, so a retry also retries the extraction.
      const resumeText =
        application.resume.extracted_text ??
        (await this.resumeText.extractStored(application.resume.id));
      const result = await this.score(application.posting, resumeText);
      return await this.save(applicationId, {
        ...result,
        status: 'completed',
        retry_count,
        failure_reason: null,
      });
    } catch (err) {
      const failure_reason = failureReason(err);
      if (failure_reason === null) throw err;
      this.logger.warn(
        `Screening ${applicationId} failed: ${(err as Error).message}`,
      );
      await this.save(applicationId, {
        fit_score: null,
        explanation: null,
        requirement_matches: null,
        status: 'failed',
        retry_count,
        failure_reason,
      });
      throw new UnprocessableEntityException({
        message: 'AI screening could not be completed.',
        status: 'failed',
        retry_count,
        failure_reason,
      });
    }
  }

  private async score(
    posting: ScreeningPosting,
    resumeText: string | null,
  ): Promise<ScreeningResult> {
    if (!resumeText?.trim()) {
      throw new MissingResumeTextError('The resume has no extracted text.');
    }
    const reply = await this.gemini.generateJson({
      systemPrompt: SCREENING_SYSTEM_PROMPT,
      prompt: buildScreeningPrompt(posting, resumeText),
      responseSchema: SCREENING_RESPONSE_SCHEMA,
    });
    return parseScreeningResult(reply, splitRequirements(posting.requirements));
  }

  /** One row per application: a retry overwrites the last result. */
  private async save(
    applicationId: number,
    values: Omit<typeof aiScreenings.$inferInsert, 'application_id'>,
  ) {
    const row = { ...values, screened_at: new Date() };
    const [saved] = await this.db
      .insert(aiScreenings)
      .values({ application_id: applicationId, ...row })
      .onConflictDoUpdate({ target: aiScreenings.application_id, set: row })
      .returning();
    return saved;
  }
}
