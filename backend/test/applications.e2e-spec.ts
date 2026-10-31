import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import 'dotenv/config';
import { eq, inArray } from 'drizzle-orm';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { DB, type Database } from '../src/database/database.module.js';
import {
  applicantProfiles,
  applications,
  jobPostings,
} from '../src/database/schema.js';

/**
 * Runs against the database in backend/.env (seeded sample accounts required).
 * Every posting and application created here is deleted afterwards.
 * Run with: npm run test:e2e
 */
describe('Applications (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let manager: { Authorization: string };
  let openPostingId: number;
  let closedPostingId: number;

  const api = () => request(app.getHttpServer());

  const applicant = {
    full_name: 'E2E Juan Dela Cruz',
    email: 'e2e.juan@example.com',
    phone: '+63 917 123 4567',
    portfolio_url: 'https://github.com/e2e-juan',
    cover_note: 'Two years of Angular experience.',
  };

  const createPosting = async (status: 'open' | 'closed') => {
    const { body } = await api()
      .post('/api/job-postings')
      .set(manager)
      .send({
        title: `E2E Applications ${status}`,
        department: 'IT',
        location: 'Cavite',
        description: 'Posting created by the applications e2e test.',
        requirements: 'JavaScript\nSQL',
        status,
      })
      .expect(201);
    return body.job_posting.id as number;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
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

    openPostingId = await createPosting('open');
    closedPostingId = await createPosting('closed');
  });

  afterAll(async () => {
    const postingIds = [openPostingId, closedPostingId].filter(Boolean);
    if (postingIds.length) {
      // Profiles and resumes are removed with their application (cascade).
      await db
        .delete(applications)
        .where(inArray(applications.job_posting_id, postingIds));
      await db.delete(jobPostings).where(inArray(jobPostings.id, postingIds));
    }
    await app.close();
  });

  it('lets anyone apply to an open posting without signing in', async () => {
    const { body } = await api()
      .post('/api/applications')
      .send({ job_posting_id: openPostingId, ...applicant })
      .expect(201);

    expect(body.message).toBe('Application submitted successfully.');
    expect(body.application).toMatchObject({
      job_posting_id: openPostingId,
      kanban_stage: 'Applied',
    });
    expect(body.upload_token).toMatch(/^[0-9a-f]{64}$/);

    const profile = await db.query.applicantProfiles.findFirst({
      where: eq(applicantProfiles.application_id, body.application.id),
    });
    expect(profile).toMatchObject(applicant);
  });

  it('rejects a second application with the same email (409)', async () => {
    const { body } = await api()
      .post('/api/applications')
      .send({
        job_posting_id: openPostingId,
        ...applicant,
        email: 'E2E.Juan@Example.com',
      })
      .expect(409);
    expect(body.error).toMatch(/already applied/);
  });

  it('rejects applications to a closed posting (400)', async () => {
    const { body } = await api()
      .post('/api/applications')
      .send({ job_posting_id: closedPostingId, ...applicant })
      .expect(400);
    expect(body.error).toMatch(/no longer accepting/);
  });

  it('returns 404 for a posting that does not exist', async () => {
    await api()
      .post('/api/applications')
      .send({ job_posting_id: 999_999_999, ...applicant })
      .expect(404);
  });

  it('lists every invalid field', async () => {
    const { body } = await api()
      .post('/api/applications')
      .send({ job_posting_id: openPostingId, full_name: '', email: 'nope' })
      .expect(400);
    expect(body.error).toBe('Some fields are invalid.');
    expect(body.details).toEqual(
      expect.arrayContaining([
        'Enter your full name.',
        'Enter a valid email address.',
      ]),
    );
  });

  it('does not let applicants choose their own pipeline stage', async () => {
    await api()
      .post('/api/applications')
      .send({
        job_posting_id: openPostingId,
        ...applicant,
        email: 'e2e.stage@example.com',
        kanban_stage: 'Offer',
      })
      .expect(400);
  });
});
