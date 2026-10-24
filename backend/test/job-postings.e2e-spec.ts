import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import 'dotenv/config';
import { inArray } from 'drizzle-orm';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { DB, type Database } from '../src/database/database.module.js';
import { jobPostings } from '../src/database/schema.js';

/**
 * Runs against the database in backend/.env (seeded sample accounts required).
 * Every posting created here is deleted afterwards.
 * Run with: npm run test:e2e
 */
describe('Job postings (e2e)', () => {
  let app: INestApplication;
  let manager: { Authorization: string };
  let recruiter: { Authorization: string };
  const created: number[] = [];

  const sample = {
    title: 'E2E Software Developer',
    department: 'IT',
    location: 'Cavite',
    description: 'Develop and maintain software applications.',
    requirements: 'JavaScript\nSQL\nGit',
  };

  const api = () => request(app.getHttpServer());

  const tokenFor = async (email: string, password: string) => {
    const { body } = await api()
      .post('/api/auth/login')
      .send({ email, password });
    return { Authorization: `Bearer ${body.token}` };
  };

  const createPosting = async (body: object = sample) => {
    const res = await api()
      .post('/api/job-postings')
      .set(manager)
      .send(body)
      .expect(201);
    created.push(res.body.job_posting.id);
    return res.body.job_posting;
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

    manager = await tokenFor('manager@talentflow.dev', 'Manager123!');
    recruiter = await tokenFor('recruiter@talentflow.dev', 'Recruiter123!');
  });

  afterAll(async () => {
    if (created.length) {
      await app
        .get<Database>(DB)
        .delete(jobPostings)
        .where(inArray(jobPostings.id, created));
    }
    await app.close();
  });

  it('lets a manager create a posting and cleans up the requirements', async () => {
    const posting = await createPosting({
      ...sample,
      requirements: '- JavaScript\n\nSQL\nsql\nGit',
    });
    expect(posting).toMatchObject({
      title: 'E2E Software Developer',
      requirements: 'JavaScript\nSQL\nGit',
      status: 'open',
    });
  });

  it('blocks recruiters (403) and visitors (401) from creating', async () => {
    await api()
      .post('/api/job-postings')
      .set(recruiter)
      .send(sample)
      .expect(403);
    await api().post('/api/job-postings').send(sample).expect(401);
  });

  it('returns field errors for an invalid posting', async () => {
    const res = await api()
      .post('/api/job-postings')
      .set(manager)
      .send({ ...sample, title: 'x', requirements: '' })
      .expect(400);
    expect(res.body.details).toHaveLength(2);
  });

  it('edits a posting', async () => {
    const { id } = await createPosting();
    const res = await api()
      .patch(`/api/job-postings/${id}`)
      .set(manager)
      .send({ location: 'Makati' })
      .expect(200);
    expect(res.body.job_posting.location).toBe('Makati');
    expect(res.body.job_posting.title).toBe(sample.title);
  });

  it('rejects null fields on edit', () =>
    api()
      .patch(`/api/job-postings/${created[0]}`)
      .set(manager)
      .send({ title: null })
      .expect(400));

  it('returns 404 for a posting that does not exist', async () => {
    await api()
      .patch('/api/job-postings/999999')
      .set(manager)
      .send({ location: 'Makati' })
      .expect(404);
    await api().get('/api/job-postings/not-a-number').expect(404);
  });

  it('closing hides a posting from visitors but not from staff', async () => {
    const { id } = await createPosting();
    await api().get(`/api/job-postings/${id}`).expect(200);

    const res = await api()
      .patch(`/api/job-postings/${id}/status`)
      .set(manager)
      .send({ status: 'closed' })
      .expect(200);
    expect(res.body.job_posting.status).toBe('closed');

    await api().get(`/api/job-postings/${id}`).expect(404);
    const publicList = await api()
      .get('/api/job-postings?status=closed')
      .expect(200);
    expect(publicList.body.map((p: { id: number }) => p.id)).not.toContain(id);

    const staffList = await api()
      .get('/api/job-postings?status=closed')
      .set(recruiter)
      .expect(200);
    expect(staffList.body.map((p: { id: number }) => p.id)).toContain(id);
  });

  it('does not let a recruiter change status', () =>
    api()
      .patch(`/api/job-postings/${created[0]}/status`)
      .set(recruiter)
      .send({ status: 'closed' })
      .expect(403));

  it('hides internal fields from visitors', async () => {
    const { id } = await createPosting();
    const res = await api().get(`/api/job-postings/${id}`).expect(200);
    expect(res.body).not.toHaveProperty('created_by');
    expect(res.body).not.toHaveProperty('author');
  });
});
