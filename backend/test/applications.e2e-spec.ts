import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import 'dotenv/config';
import { eq, inArray } from 'drizzle-orm';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { DB, type Database } from '../src/database/database.module.js';
import {
  aiScreenings,
  applicantProfiles,
  applications,
  jobPostings,
  resumes,
  users,
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
  /** Applicant account made for the list tests; deleted afterwards. */
  const applicantEmail = `e2e.list.${Date.now()}@example.com`;

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
    await db.delete(users).where(eq(users.email, applicantEmail));
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

  /** Applies straight in the database, so the list tests don't share emails. */
  const addApplication = async (email: string) => {
    const [created] = await db
      .insert(applications)
      .values({ job_posting_id: openPostingId })
      .returning({ id: applications.id });
    await db.insert(applicantProfiles).values({
      application_id: created.id,
      full_name: 'E2E List Applicant',
      email,
    });
    return created.id;
  };

  const signIn = async (email: string, password: string) => {
    const { body } = await api()
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    return { Authorization: `Bearer ${body.token}` };
  };

  it('lists applications for staff with the posting and screening', async () => {
    const plainId = await addApplication('e2e.list.plain@example.com');
    const scoredId = await addApplication('e2e.list.scored@example.com');
    await db.insert(resumes).values({
      application_id: scoredId,
      file_url: '/api/resumes/0/file',
      file_name: 'cv.pdf',
      mime_type: 'application/pdf',
      size_bytes: 8,
      data: Buffer.from('%PDF-1.7'),
    });
    await db.insert(aiScreenings).values({
      application_id: scoredId,
      fit_score: 75,
      explanation: 'Meets most requirements.',
      requirement_matches: [
        { requirement: 'JavaScript', match: 'met', evidence: '2 years' },
        { requirement: 'SQL', match: 'partial', evidence: 'School project' },
      ],
      status: 'completed',
    });

    const { body } = await api()
      .get('/api/applications')
      .set(manager)
      .expect(200);

    const plain = body.find((a: { id: number }) => a.id === plainId);
    const scored = body.find((a: { id: number }) => a.id === scoredId);
    expect(plain).toMatchObject({
      job_posting_id: openPostingId,
      posting_title: 'E2E Applications open',
      full_name: 'E2E List Applicant',
      email: 'e2e.list.plain@example.com',
      kanban_stage: 'Applied',
      has_resume: false,
      screening: null,
    });
    expect(plain.submitted_at).toEqual(expect.any(String));
    expect(scored).toMatchObject({
      has_resume: true,
      screening: { fit_score: 75, status: 'completed', retry_count: 0 },
    });
    expect(scored.screening.requirement_matches).toHaveLength(2);
    // Contact details beyond name and email stay out of the list.
    expect(plain).not.toHaveProperty('phone');
  });

  it('lists the newest application first', async () => {
    const olderId = await addApplication('e2e.list.older@example.com');
    const newerId = await addApplication('e2e.list.newer@example.com');
    const { body } = await api()
      .get('/api/applications')
      .set(manager)
      .expect(200);
    const ids = body.map((a: { id: number }) => a.id);
    expect(ids.indexOf(newerId)).toBeLessThan(ids.indexOf(olderId));
  });

  it('lets recruiters see the list too', async () => {
    const recruiter = await signIn('recruiter@talentflow.dev', 'Recruiter123!');
    await api().get('/api/applications').set(recruiter).expect(200);
  });

  it('keeps applicants and signed-out visitors out (403, 401)', async () => {
    await api()
      .post('/api/auth/register-applicant')
      .send({
        email: applicantEmail,
        password: 'Password123',
        first_name: 'E2E',
        last_name: 'Applicant',
      })
      .expect(201);
    const asApplicant = await signIn(applicantEmail, 'Password123');

    await api().get('/api/applications').set(asApplicant).expect(403);
    // Applicants can't run or read AI screenings either.
    await api()
      .post('/api/ai-screenings')
      .set(asApplicant)
      .send({ application_id: 1 })
      .expect(403);
    await api().get('/api/ai-screenings/1').set(asApplicant).expect(403);
    await api().get('/api/applications').expect(401);
  });
});
