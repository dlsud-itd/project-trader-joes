import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import {
  GeminiClient,
  GeminiError,
  GeminiFailure,
} from '../src/ai-screenings/gemini.client.js';
import { FAILURE_REASONS } from '../src/ai-screenings/screening-failure.js';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { DB, type Database } from '../src/database/database.module.js';
import {
  aiScreenings,
  applications,
  jobPostings,
  resumes,
} from '../src/database/schema.js';
import { buildPdf } from './resume-files.js';

/**
 * Runs against the database in backend/.env (seeded sample accounts required).
 * Gemini is replaced by a fake, so no API key or quota is needed.
 * The posting and applications created here are deleted afterwards.
 * Run with: npm run test:e2e
 */
describe('AI screenings (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let manager: { Authorization: string };
  let postingId: number;

  const gemini = { generateJson: vi.fn<() => Promise<string>>() };
  const api = () => request(app.getHttpServer());

  const goodReply = JSON.stringify({
    requirements: [
      { number: 1, match: 'met', evidence: 'Built a React app in JavaScript.' },
      { number: 2, match: 'partial', evidence: 'Took a databases course.' },
      {
        number: 3,
        match: 'missing',
        evidence: 'No version control mentioned.',
      },
    ],
    explanation: 'Strong JavaScript; some SQL; no Git.',
  });

  /**
   * An application, with a resume unless `resume` is false. `file` is the
   * stored file, which is read when `text` is null.
   */
  const apply = async (
    resume: { text: string | null; file?: Buffer } | false = {
      text: 'Juan: JavaScript.',
    },
  ) => {
    const [created] = await db
      .insert(applications)
      .values({ job_posting_id: postingId })
      .returning({ id: applications.id });
    if (resume) {
      await db.insert(resumes).values({
        application_id: created.id,
        file_url: '/api/resumes/0/file',
        file_name: 'cv.pdf',
        mime_type: 'application/pdf',
        size_bytes: resume.file?.length ?? 8,
        data: resume.file ?? Buffer.from('%PDF-1.7'),
        extracted_text: resume.text,
      });
    }
    return created.id;
  };

  const screen = (application_id: unknown, retry?: boolean) =>
    api()
      .post('/api/ai-screenings')
      .set(manager)
      .send({ application_id, ...(retry === undefined ? {} : { retry }) });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GeminiClient)
      .useValue(gemini)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    db = app.get<Database>(DB);

    const { body } = await api()
      .post('/api/auth/login')
      .send({ email: 'manager@talentflow.dev', password: 'Manager123!' });
    manager = { Authorization: `Bearer ${body.token}` };

    const created = await api()
      .post('/api/job-postings')
      .set(manager)
      .send({
        title: 'E2E AI Screening',
        department: 'IT',
        location: 'Cavite',
        description: 'Posting created by the AI screenings e2e test.',
        requirements: 'JavaScript\nSQL\nGit',
      })
      .expect(201);
    postingId = created.body.job_posting.id;
  });

  beforeEach(() => gemini.generateJson.mockReset());

  afterAll(async () => {
    if (postingId) {
      // Resumes and screenings are removed with their application (cascade).
      await db
        .delete(applications)
        .where(eq(applications.job_posting_id, postingId));
      await db.delete(jobPostings).where(eq(jobPostings.id, postingId));
    }
    await app.close();
  });

  it('scores a resume, saves it, and sends the posting to Gemini', async () => {
    gemini.generateJson.mockResolvedValue(goodReply);
    const id = await apply();

    const { body } = await screen(id).expect(200);

    expect(body.message).toBe('AI screening processed successfully.');
    expect(body.screening).toMatchObject({
      application_id: id,
      fit_score: 50,
      explanation: 'Strong JavaScript; some SQL; no Git.',
      status: 'completed',
      retry_count: 0,
    });
    expect(body.screening.requirement_matches).toEqual([
      expect.objectContaining({ requirement: 'JavaScript', match: 'met' }),
      expect.objectContaining({ requirement: 'SQL', match: 'partial' }),
      expect.objectContaining({ requirement: 'Git', match: 'missing' }),
    ]);

    const [sent] = gemini.generateJson.mock.calls[0] as unknown as [
      { prompt: string },
    ];
    expect(sent.prompt).toContain('1. JavaScript\n2. SQL\n3. Git');
    expect(sent.prompt).toContain('Juan: JavaScript.');

    const saved = await api()
      .get(`/api/ai-screenings/${id}`)
      .set(manager)
      .expect(200);
    expect(saved.body).toMatchObject({ fit_score: 50, status: 'completed' });
  });

  it('returns the saved score instead of calling Gemini again', async () => {
    gemini.generateJson.mockResolvedValue(goodReply);
    const id = await apply();
    await screen(id).expect(200);

    const { body } = await screen(id).expect(200);

    expect(body.screening.fit_score).toBe(50);
    expect(gemini.generateJson).toHaveBeenCalledTimes(1);
  });

  it('saves a failed screening and answers 422 when Gemini fails', async () => {
    gemini.generateJson.mockImplementationOnce(async () => {
      throw new GeminiError('503 after retries', GeminiFailure.BUSY);
    });
    const id = await apply();

    const { body } = await screen(id).expect(422);

    expect(body).toEqual({
      error: 'AI screening could not be completed.',
      status: 'failed',
      retry_count: 0,
      failure_reason: FAILURE_REASONS[GeminiFailure.BUSY],
    });
    const [row] = await db
      .select()
      .from(aiScreenings)
      .where(eq(aiScreenings.application_id, id));
    expect(row).toMatchObject({
      status: 'failed',
      fit_score: null,
      failure_reason: FAILURE_REASONS[GeminiFailure.BUSY],
    });
  });

  it('says when the daily Gemini limit is used up', async () => {
    gemini.generateJson.mockImplementationOnce(async () => {
      throw new GeminiError('quota', GeminiFailure.DAILY_LIMIT);
    });
    const id = await apply();
    const { body } = await screen(id).expect(422);
    expect(body.failure_reason).toMatch(/Try again tomorrow/);
  });

  it('treats an unusable Gemini reply as a failed screening', async () => {
    gemini.generateJson.mockResolvedValue('The candidate looks great!');
    const id = await apply();
    const { body } = await screen(id).expect(422);
    expect(body).toMatchObject({
      status: 'failed',
      failure_reason: FAILURE_REASONS.invalidAnswer,
    });
  });

  it('asks for retry after a failure, then retries and counts it', async () => {
    gemini.generateJson.mockImplementationOnce(async () => {
      throw new GeminiError('timeout', GeminiFailure.BUSY);
    });
    const id = await apply();
    await screen(id).expect(422);

    const again = await screen(id).expect(409);
    expect(again.body.error).toMatch(/retry/);

    gemini.generateJson.mockResolvedValue(goodReply);
    const { body } = await screen(id, true).expect(200);
    expect(body.screening).toMatchObject({
      status: 'completed',
      fit_score: 50,
      retry_count: 1,
      failure_reason: null,
    });
  });

  it('screens the same application once when asked twice at once', async () => {
    gemini.generateJson.mockResolvedValue(goodReply);
    const id = await apply();

    const [first, second] = await Promise.all([screen(id), screen(id)]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.screening.id).toBe(first.body.screening.id);
    expect(gemini.generateJson).toHaveBeenCalledTimes(1);
  });

  it('reads the text from the stored file when it is missing', async () => {
    gemini.generateJson.mockResolvedValue(goodReply);
    const file = buildPdf(['Ana Reyes', 'SKILLS: JavaScript, SQL']);
    const id = await apply({ text: null, file });

    await screen(id).expect(200);

    const [sent] = gemini.generateJson.mock.calls[0] as unknown as [
      { prompt: string },
    ];
    expect(sent.prompt).toContain('Ana Reyes\nSKILLS: JavaScript, SQL');
    const [resume] = await db
      .select({ extracted_text: resumes.extracted_text })
      .from(resumes)
      .where(eq(resumes.application_id, id));
    expect(resume.extracted_text).toBe('Ana Reyes\nSKILLS: JavaScript, SQL');
  });

  it('skips Gemini when the resume has no readable text', async () => {
    const id = await apply({ text: null });
    const { body } = await screen(id).expect(422);
    expect(body).toMatchObject({
      status: 'failed',
      failure_reason: FAILURE_REASONS.missingText,
    });
    expect(gemini.generateJson).not.toHaveBeenCalled();
  });

  it('needs a resume before screening (400)', async () => {
    const id = await apply(false);
    const { body } = await screen(id).expect(400);
    expect(body.error).toBe('Upload a resume before screening.');
  });

  it('returns 404 for an unknown application or a missing screening', async () => {
    await screen(999_999_999).expect(404);
    const id = await apply();
    await api().get(`/api/ai-screenings/${id}`).set(manager).expect(404);
  });

  it('rejects an invalid body (400)', async () => {
    const { body } = await screen('abc').expect(400);
    expect(body.error).toBe('Some fields are invalid.');
  });

  it('is for signed-in staff only (401)', async () => {
    await api()
      .post('/api/ai-screenings')
      .send({ application_id: 1 })
      .expect(401);
    await api().get('/api/ai-screenings/1').expect(401);
  });
});
