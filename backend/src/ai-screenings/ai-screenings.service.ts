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
import { GeminiClient, GeminiError } from './gemini.client.js';
import {
  buildScreeningPrompt,
  SCREENING_RESPONSE_SCHEMA,
  SCREENING_SYSTEM_PROMPT,
  splitRequirements,
  type ScreeningPosting,
} from './screening-prompt.js';
import {
  InvalidScreeningResponseError,
  parseScreeningResult,
  type ScreeningResult,
} from './screening-result.js';

/** Thrown when the resume has no text to screen yet. */
class MissingResumeTextError extends Error {}

@Injectable()
export class AiScreeningsService {
  private readonly logger = new Logger(AiScreeningsService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly gemini: GeminiClient,
  ) {}

  /**
   * Scores the application's resume against its posting and saves the result.
   * A finished screening is returned as is unless `retry` is set.
   */
  async screen(applicationId: number, retry: boolean) {
    const application = await this.db.query.applications.findFirst({
      where: eq(applications.id, applicationId),
      columns: { id: true },
      with: {
        posting: {
          columns: { title: true, description: true, requirements: true },
        },
        resume: { columns: { extracted_text: true } },
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
      const result = await this.score(
        application.posting,
        application.resume.extracted_text,
      );
      return await this.save(applicationId, {
        ...result,
        status: 'completed',
        retry_count,
      });
    } catch (err) {
      if (
        !(err instanceof GeminiError) &&
        !(err instanceof InvalidScreeningResponseError) &&
        !(err instanceof MissingResumeTextError)
      ) {
        throw err;
      }
      this.logger.warn(`Screening ${applicationId} failed: ${err.message}`);
      await this.save(applicationId, {
        fit_score: null,
        explanation: null,
        requirement_matches: null,
        status: 'failed',
        retry_count,
      });
      throw new UnprocessableEntityException({
        message: 'AI screening could not be completed.',
        status: 'failed',
        retry_count,
      });
    }
  }

  /** The saved screening for an application. */
  async findOne(applicationId: number) {
    const screening = await this.db.query.aiScreenings.findFirst({
      where: eq(aiScreenings.application_id, applicationId),
    });
    if (!screening) throw new NotFoundException('AI screening not found.');
    return screening;
  }

  private async score(
    posting: ScreeningPosting,
    resumeText: string | null,
  ): Promise<ScreeningResult> {
    // Resume text extraction (WBS 4.3.2.1) fills resumes.extracted_text.
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
