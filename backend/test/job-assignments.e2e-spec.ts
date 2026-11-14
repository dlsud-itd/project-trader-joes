import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import 'dotenv/config';
import { eq, inArray } from 'drizzle-orm';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { DB, type Database } from '../src/database/database.module.js';
import { jobAssignments, jobPostings, users } from '../src/database/schema.js';

type Credentials = { email: string; password: string };
type AuthHeader = { Authorization: string };

const MANAGER: Credentials = {
  email: 'manager@talentflow.dev',
  password: 'Manager123!',
};
const RECRUITER: Credentials = {
  email: 'recruiter@talentflow.dev',
  password: 'Recruiter123!',
};
const UNKNOWN_ID = 999_999_999;

/**
 * Runs against the database in backend/.env (seeded sample accounts required).
 * Every posting created here is deleted afterwards, which also removes its
 * assignments.
 * Run with: npm run test:e2e
 */
describe('Job assignments (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let manager: AuthHeader;
  let recruiter: AuthHeader;
  let managerId: number;
  let recruiterId: number;
  const postingIds: number[] = [];

  const api = () => request(app.getHttpServer());

  const signIn = async ({ email, password }: Credentials) => {
    const { body } = await api()
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    return {
      header: { Authorization: `Bearer ${body.token}` },
      id: body.user.id as number,
    };
  };

  const createPosting = async () => {
    const { body } = await api()
      .post('/api/job-postings')
      .set(manager)
      .send({
        title: 'E2E Assignments',
        department: 'IT',
        location: 'Cavite',
        description: 'Posting created by the job assignments e2e test.',
        requirements: 'JavaScript',
        status: 'open',
      })
      .expect(201);
    postingIds.push(body.job_posting.id);
    return body.job_posting.id as number;
  };

  const assign = (job_posting_id: number, user_id: number) =>
    api()
      .post('/api/job-assignments')
      .set(manager)
      .send({ job_posting_id, user_id });

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

    const asManager = await signIn(MANAGER);
    const asRecruiter = await signIn(RECRUITER);
    manager = asManager.header;
    managerId = asManager.id;
    recruiter = asRecruiter.header;
    recruiterId = asRecruiter.id;
  });

  afterAll(async () => {
    if (postingIds.length) {
      await db.delete(jobPostings).where(inArray(jobPostings.id, postingIds));
    }
    await app.close();
  });

  it('lets a manager assign a recruiter to a posting', async () => {
    const postingId = await createPosting();
    const { body } = await assign(postingId, recruiterId).expect(201);

    expect(body.message).toBe('User assigned to job posting successfully.');
    expect(body.assignment).toMatchObject({
      job_posting_id: postingId,
      user_id: recruiterId,
    });
    expect(body.assignment.id).toEqual(expect.any(Number));
    expect(body.assignment.assigned_at).toEqual(expect.any(String));
  });

  it('rejects assigning the same recruiter twice (409)', async () => {
    const postingId = await createPosting();
    await assign(postingId, recruiterId).expect(201);
    const { body } = await assign(postingId, recruiterId).expect(409);
    expect(body.error).toBe('User is already assigned to this job posting.');
  });

  it('lists assignments with the recruiter for all staff', async () => {
    const postingId = await createPosting();
    const { body: created } = await assign(postingId, recruiterId).expect(201);

    const { body } = await api()
      .get('/api/job-assignments')
      .set(recruiter)
      .expect(200);
    const listed = body.find(
      (a: { id: number }) => a.id === created.assignment.id,
    );
    expect(listed).toMatchObject({
      job_posting_id: postingId,
      user_id: recruiterId,
      user: { id: recruiterId, email: RECRUITER.email },
    });
    expect(listed.user).not.toHaveProperty('password_hash');
  });

  it('only assigns recruiters (400 for a manager)', async () => {
    const postingId = await createPosting();
    const { body } = await assign(postingId, managerId).expect(400);
    expect(body.error).toBe('Only recruiters can be assigned to job postings.');
  });

  it('returns 404 for an unknown posting or user', async () => {
    const postingId = await createPosting();
    const noPosting = await assign(UNKNOWN_ID, recruiterId).expect(404);
    expect(noPosting.body.error).toBe('Job posting not found.');
    const noUser = await assign(postingId, UNKNOWN_ID).expect(404);
    expect(noUser.body.error).toBe('User not found.');
  });

  it('lists every invalid field', async () => {
    const { body } = await api()
      .post('/api/job-assignments')
      .set(manager)
      .send({ job_posting_id: 'abc' })
      .expect(400);
    expect(body.error).toBe('Some fields are invalid.');
    expect(body.details).toEqual(
      expect.arrayContaining(['Choose a job posting.', 'Choose a recruiter.']),
    );
  });

  it('lets only managers assign or remove (recruiters 403)', async () => {
    const postingId = await createPosting();
    await api()
      .post('/api/job-assignments')
      .set(recruiter)
      .send({ job_posting_id: postingId, user_id: recruiterId })
      .expect(403);

    const { body } = await assign(postingId, recruiterId).expect(201);
    await api()
      .delete(`/api/job-assignments/${body.assignment.id}`)
      .set(recruiter)
      .expect(403);
    await api().get('/api/job-assignments').expect(401);
  });

  it('removes an assignment, then 404 for it', async () => {
    const postingId = await createPosting();
    const { body: created } = await assign(postingId, recruiterId).expect(201);
    const url = `/api/job-assignments/${created.assignment.id}`;

    const { body } = await api().delete(url).set(manager).expect(200);
    expect(body.message).toBe('User removed from job posting.');
    const again = await api().delete(url).set(manager).expect(404);
    expect(again.body.error).toBe('Assignment not found.');
    await api().delete('/api/job-assignments/abc').set(manager).expect(404);
  });

  it('removes the assignments when their posting is deleted', async () => {
    const postingId = await createPosting();
    await assign(postingId, recruiterId).expect(201);

    await api()
      .delete(`/api/job-postings/${postingId}`)
      .set(manager)
      .expect(200);
    const left = await db
      .select({ id: jobAssignments.id })
      .from(jobAssignments)
      .where(eq(jobAssignments.job_posting_id, postingId));
    expect(left).toEqual([]);
    const stillThere = await db.query.users.findFirst({
      where: eq(users.id, recruiterId),
    });
    expect(stillThere).toBeDefined();
  });
});
