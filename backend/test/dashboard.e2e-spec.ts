import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import 'dotenv/config';
import { inArray } from 'drizzle-orm';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { DB, type Database } from '../src/database/database.module.js';
import { applications, jobPostings, users } from '../src/database/schema.js';

type AuthHeader = { Authorization: string };

type PostingMetrics = {
  id: number;
  status: string;
  candidates: number;
  active: number;
  stages: Record<string, number>;
};

type Summary = {
  scope: 'all' | 'assigned';
  postings: { open: number; closed: number; total: number };
  candidates: {
    total: number;
    new_this_week: number;
    awaiting_your_rating: number;
  };
  stages: { stage: string; count: number }[];
  by_posting: PostingMetrics[];
};

const MANAGER = { email: 'manager@talentflow.dev', password: 'Manager123!' };
const RECRUITER = {
  email: 'recruiter@talentflow.dev',
  password: 'Recruiter123!',
};
const STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Rejected'];

/**
 * Recruiter dashboard metrics (WBS 4.5.4.1). Runs against the database in
 * backend/.env (seeded sample accounts required). Other data may already be
 * there, so exact numbers are checked per posting, and totals are checked
 * against what each caller is allowed to see. Everything made here is
 * deleted afterwards.
 * Run with: npm run test:e2e
 */
describe('Dashboard (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let manager: AuthHeader;
  let recruiter: AuthHeader;
  let recruiterId: number;
  let applicant: AuthHeader;
  let assignedId: number;
  let otherId: number;
  let closedId: number;
  const applicantEmail = `e2e.dashboard.${Date.now()}@example.com`;
  /** A recruiter made here, with no assignments at all. */
  const newRecruiterEmail = `e2e.dashboard.recruiter.${Date.now()}@example.com`;
  let newRecruiter: AuthHeader;

  const api = () => request(app.getHttpServer());

  const signIn = async (email: string, password: string) => {
    const { body } = await api()
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    return {
      header: { Authorization: `Bearer ${body.token}` },
      id: body.user.id as number,
    };
  };

  const createPosting = async (title: string) => {
    const { body } = await api()
      .post('/api/job-postings')
      .set(manager)
      .send({
        title,
        department: 'IT',
        location: 'Cavite',
        description: 'Posting created by the dashboard e2e test.',
        requirements: 'TypeScript',
        status: 'open',
      })
      .expect(201);
    return body.job_posting.id as number;
  };

  const apply = async (postingId: number, email: string) => {
    const { body } = await api()
      .post('/api/applications')
      .send({ job_posting_id: postingId, full_name: 'E2E Dash', email })
      .expect(201);
    return body.application.id as number;
  };

  const summary = async (who: AuthHeader): Promise<Summary> => {
    const { body } = await api().get('/api/dashboard').set(who).expect(200);
    return body;
  };

  const posting = (s: Summary, id: number) =>
    s.by_posting.find((p) => p.id === id);

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

    manager = (await signIn(MANAGER.email, MANAGER.password)).header;
    const asRecruiter = await signIn(RECRUITER.email, RECRUITER.password);
    recruiter = asRecruiter.header;
    recruiterId = asRecruiter.id;

    await api()
      .post('/api/auth/register-applicant')
      .send({
        email: applicantEmail,
        password: 'Password123',
        first_name: 'E2E',
        last_name: 'Applicant',
      })
      .expect(201);
    applicant = (await signIn(applicantEmail, 'Password123')).header;

    await api()
      .post('/api/auth/register')
      .set(manager)
      .send({
        email: newRecruiterEmail,
        password: 'Password123',
        first_name: 'E2E',
        last_name: 'Recruiter',
        role: 'recruiter',
      })
      .expect(201);
    newRecruiter = (await signIn(newRecruiterEmail, 'Password123')).header;

    assignedId = await createPosting('E2E Dashboard Assigned');
    otherId = await createPosting('E2E Dashboard Not Assigned');
    closedId = await createPosting('E2E Dashboard Closed');

    // Assigned: three applicants, one moved to Interview, one rejected.
    const first = await apply(assignedId, 'e2e.dash.one@example.com');
    await apply(assignedId, 'e2e.dash.two@example.com');
    const third = await apply(assignedId, 'e2e.dash.three@example.com');
    for (const [id, kanban_stage] of [
      [first, 'Interview'],
      [third, 'Rejected'],
    ] as const) {
      await api()
        .patch(`/api/applications/${id}/stage`)
        .set(manager)
        .send({ kanban_stage })
        .expect(200);
    }
    // Not assigned: two applicants the recruiter must not see.
    await apply(otherId, 'e2e.dash.four@example.com');
    await apply(otherId, 'e2e.dash.five@example.com');
    // Closed after one applicant applied.
    await apply(closedId, 'e2e.dash.six@example.com');
    await api()
      .patch(`/api/job-postings/${closedId}/status`)
      .set(manager)
      .send({ status: 'closed' })
      .expect(200);

    await api()
      .post('/api/job-assignments')
      .set(manager)
      .send({ job_posting_id: assignedId, user_id: recruiterId })
      .expect(201);
  });

  afterAll(async () => {
    const ids = [assignedId, otherId, closedId].filter(Boolean);
    if (ids.length) {
      // Assignments, notes, and ratings go with their rows (cascade).
      await db
        .delete(applications)
        .where(inArray(applications.job_posting_id, ids));
      await db.delete(jobPostings).where(inArray(jobPostings.id, ids));
    }
    await db
      .delete(users)
      .where(inArray(users.email, [applicantEmail, newRecruiterEmail]));
    await app.close();
  });

  describe('managers', () => {
    it('see every posting, with counts per stage', async () => {
      const s = await summary(manager);
      expect(s.scope).toBe('all');

      expect(posting(s, assignedId)).toMatchObject({
        status: 'open',
        candidates: 3,
        active: 2,
        stages: {
          Applied: 1,
          Screening: 0,
          Interview: 1,
          Offer: 0,
          Rejected: 1,
        },
      });
      expect(posting(s, otherId)).toMatchObject({ candidates: 2, active: 2 });
      expect(posting(s, closedId)).toMatchObject({
        status: 'closed',
        candidates: 1,
      });
    });

    it('get totals that match the posting rows', async () => {
      const s = await summary(manager);
      const sum = (pick: (p: PostingMetrics) => number) =>
        s.by_posting.reduce((total, p) => total + pick(p), 0);

      expect(s.stages.map((x) => x.stage)).toEqual(STAGES);
      expect(s.candidates.total).toBe(sum((p) => p.candidates));
      for (const { stage, count } of s.stages) {
        expect(count).toBe(sum((p) => p.stages[stage]));
      }
      expect(s.postings.total).toBe(s.by_posting.length);
      expect(s.postings.open).toBe(
        s.by_posting.filter((p) => p.status === 'open').length,
      );
      expect(s.postings.open + s.postings.closed).toBe(s.postings.total);
      // Everything here was made just now.
      expect(s.candidates.new_this_week).toBeGreaterThanOrEqual(6);
    });
  });

  describe('recruiters', () => {
    it('only see numbers for their assigned postings', async () => {
      const s = await summary(recruiter);
      const { body: assignments } = await api()
        .get('/api/job-assignments')
        .set(recruiter)
        .expect(200);
      const mine = new Set(
        assignments
          .filter((a: { user_id: number }) => a.user_id === recruiterId)
          .map((a: { job_posting_id: number }) => a.job_posting_id),
      );

      expect(s.scope).toBe('assigned');
      expect(posting(s, assignedId)?.candidates).toBe(3);
      expect(posting(s, otherId)).toBeUndefined();
      expect(posting(s, closedId)).toBeUndefined();
      expect(s.by_posting.every((p) => mine.has(p.id))).toBe(true);
      expect(s.candidates.total).toBe(
        s.by_posting.reduce((total, p) => total + p.candidates, 0),
      );
    });

    it('count down "awaiting your rating" as they rate', async () => {
      const before = (await summary(recruiter)).candidates.awaiting_your_rating;
      const { body: list } = await api()
        .get('/api/applications')
        .set(recruiter)
        .expect(200);
      const active = list.find(
        (a: { job_posting_id: number; kanban_stage: string }) =>
          a.job_posting_id === assignedId && a.kanban_stage !== 'Rejected',
      );
      await api()
        .put(`/api/applications/${active.id}/rating`)
        .set(recruiter)
        .send({ rating: 4 })
        .expect(200);

      const after = (await summary(recruiter)).candidates.awaiting_your_rating;
      expect(after).toBe(before - 1);
      // Two of the assigned posting's applicants were still unrated.
      expect(before).toBeGreaterThanOrEqual(2);
    });

    it('see zeros, not everyone else, with no assignments', async () => {
      const s = await summary(newRecruiter);
      expect(s.scope).toBe('assigned');
      expect(s.by_posting).toEqual([]);
      expect(s.postings).toEqual({ open: 0, closed: 0, total: 0 });
      expect(s.candidates).toEqual({
        total: 0,
        new_this_week: 0,
        awaiting_your_rating: 0,
      });
      expect(s.stages.map((x) => x.count)).toEqual([0, 0, 0, 0, 0]);
    });
  });

  describe('access', () => {
    it('keeps applicants out (403) and requires signing in (401)', async () => {
      await api().get('/api/dashboard').set(applicant).expect(403);
      await api().get('/api/dashboard').expect(401);
    });
  });
});
