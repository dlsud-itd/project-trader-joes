import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import 'dotenv/config';
import { eq, inArray } from 'drizzle-orm';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { DB, type Database } from '../src/database/database.module.js';
import { applications, jobPostings, users } from '../src/database/schema.js';

type AuthHeader = { Authorization: string };

const MANAGER = { email: 'manager@talentflow.dev', password: 'Manager123!' };
const RECRUITER = {
  email: 'recruiter@talentflow.dev',
  password: 'Recruiter123!',
};
const NOT_ALLOWED = /Only managers and recruiters assigned/;

/**
 * Notes and star ratings (WBS 4.5.2.2). Runs against the database in
 * backend/.env (seeded sample accounts required). The posting, its
 * applications (with their notes and ratings), and the applicant account
 * made here are deleted afterwards.
 * Run with: npm run test:e2e
 */
describe('Notes and ratings (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let manager: AuthHeader;
  let recruiter: AuthHeader;
  let recruiterId: number;
  let applicant: AuthHeader;
  let postingId: number;
  let applicationId: number;
  let otherApplicationId: number;
  const applicantEmail = `e2e.reviews.${Date.now()}@example.com`;

  const api = () => request(app.getHttpServer());
  const notesUrl = (id = applicationId) => `/api/applications/${id}/notes`;
  const ratingUrl = (id = applicationId) => `/api/applications/${id}/rating`;

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

  const apply = async (email: string) => {
    const { body } = await api()
      .post('/api/applications')
      .send({
        job_posting_id: postingId,
        full_name: 'E2E Rated Applicant',
        email,
      })
      .expect(201);
    return body.application.id as number;
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

    const { body } = await api()
      .post('/api/job-postings')
      .set(manager)
      .send({
        title: 'E2E Notes and Ratings',
        department: 'IT',
        location: 'Cavite',
        description: 'Posting created by the notes and ratings e2e test.',
        requirements: 'JavaScript',
        status: 'open',
      })
      .expect(201);
    postingId = body.job_posting.id;
    applicationId = await apply('e2e.rated.one@example.com');
    otherApplicationId = await apply('e2e.rated.two@example.com');
  });

  afterAll(async () => {
    if (postingId) {
      // Notes and ratings are removed with their application (cascade).
      await db
        .delete(applications)
        .where(eq(applications.job_posting_id, postingId));
      await db.delete(jobPostings).where(inArray(jobPostings.id, [postingId]));
    }
    await db.delete(users).where(eq(users.email, applicantEmail));
    await app.close();
  });

  describe('notes', () => {
    it('lets a manager add a trimmed note, with their name', async () => {
      const { body } = await api()
        .post(notesUrl())
        .set(manager)
        .send({ body: '  Strong portfolio.  ' })
        .expect(201);

      expect(body.message).toBe('Note added.');
      expect(body.note).toMatchObject({
        application_id: applicationId,
        body: 'Strong portfolio.',
        author: { first_name: 'Maria', last_name: 'Santos' },
      });
      expect(body.note.created_at).toEqual(expect.any(String));
    });

    it('rejects blank and too-long notes (400)', async () => {
      const blank = await api()
        .post(notesUrl())
        .set(manager)
        .send({ body: '   ' })
        .expect(400);
      expect(blank.body.details).toContain('Write a note first.');

      const long = await api()
        .post(notesUrl())
        .set(manager)
        .send({ body: 'a'.repeat(2001) })
        .expect(400);
      expect(long.body.details).toContain(
        'Notes must be 2,000 characters or fewer.',
      );
    });

    it('never takes the author from the request body (400)', async () => {
      await api()
        .post(notesUrl())
        .set(manager)
        .send({ body: 'Posing as someone else.', author_id: recruiterId })
        .expect(400);
    });

    it('lets unassigned recruiters read notes but not add (403)', async () => {
      const { body } = await api().get(notesUrl()).set(recruiter).expect(200);
      expect(body).toHaveLength(1);

      const denied = await api()
        .post(notesUrl())
        .set(recruiter)
        .send({ body: 'Not my posting.' })
        .expect(403);
      expect(denied.body.error).toMatch(NOT_ALLOWED);
    });

    it('lets assigned recruiters add notes; newest first', async () => {
      await api()
        .post('/api/job-assignments')
        .set(manager)
        .send({ job_posting_id: postingId, user_id: recruiterId })
        .expect(201);
      await api()
        .post(notesUrl())
        .set(recruiter)
        .send({ body: 'Booked a technical interview.' })
        .expect(201);

      const { body } = await api().get(notesUrl()).set(manager).expect(200);
      expect(body.map((n: { body: string }) => n.body)).toEqual([
        'Booked a technical interview.',
        'Strong portfolio.',
      ]);
      expect(body[0].author).toMatchObject({
        first_name: 'Juan',
        last_name: 'Reyes',
      });
    });
  });

  describe('ratings', () => {
    it('starts with no ratings', async () => {
      const { body } = await api().get(ratingUrl()).set(manager).expect(200);
      expect(body).toEqual({
        average: null,
        count: 0,
        my_rating: null,
        can_review: true,
      });
    });

    it('averages one rating per person, to one decimal', async () => {
      await api().put(ratingUrl()).set(manager).send({ rating: 5 }).expect(200);
      const { body } = await api()
        .put(ratingUrl())
        .set(recruiter)
        .send({ rating: 2 })
        .expect(200);

      expect(body.message).toBe('Rating saved.');
      expect(body.rating).toEqual({
        average: 3.5,
        count: 2,
        my_rating: 2,
        can_review: true,
      });
    });

    it('changes your rating instead of adding a second one', async () => {
      const { body } = await api()
        .put(ratingUrl())
        .set(manager)
        .send({ rating: 3 })
        .expect(200);
      expect(body.rating).toMatchObject({
        average: 2.5,
        count: 2,
        my_rating: 3,
      });
    });

    it('rejects ratings outside 1–5 or not whole stars (400)', async () => {
      for (const rating of [0, 6, 3.5, '4']) {
        const { body } = await api()
          .put(ratingUrl())
          .set(manager)
          .send({ rating })
          .expect(400);
        expect(body.details).toContain('Choose a rating from 1 to 5 stars.');
      }
    });

    it('removes your own rating only', async () => {
      const { body } = await api()
        .delete(ratingUrl())
        .set(recruiter)
        .expect(200);
      expect(body.message).toBe('Rating removed.');
      expect(body.rating).toMatchObject({
        average: 3,
        count: 1,
        my_rating: null,
      });
    });

    it('returns the average with each application', async () => {
      const { body: list } = await api()
        .get('/api/applications')
        .set(manager)
        .expect(200);
      const rated = list.find((a: { id: number }) => a.id === applicationId);
      const unrated = list.find(
        (a: { id: number }) => a.id === otherApplicationId,
      );
      expect(rated.rating).toEqual({ average: 3, count: 1 });
      expect(unrated.rating).toEqual({ average: null, count: 0 });

      const { body: one } = await api()
        .get(`/api/applications/${applicationId}`)
        .set(manager)
        .expect(200);
      expect(one.rating).toEqual({ average: 3, count: 1 });
    });

    it('blocks recruiters again once taken off the posting (403)', async () => {
      const { body: assignments } = await api()
        .get('/api/job-assignments')
        .set(manager)
        .expect(200);
      const mine = assignments.find(
        (a: { job_posting_id: number }) => a.job_posting_id === postingId,
      );
      await api()
        .delete(`/api/job-assignments/${mine.id}`)
        .set(manager)
        .expect(200);

      const { body } = await api().get(ratingUrl()).set(recruiter).expect(200);
      expect(body.can_review).toBe(false);
      const denied = await api()
        .put(ratingUrl())
        .set(recruiter)
        .send({ rating: 4 })
        .expect(403);
      expect(denied.body.error).toMatch(NOT_ALLOWED);
    });
  });

  describe('access', () => {
    it('keeps applicants out (403) and requires signing in (401)', async () => {
      await api().get(notesUrl()).set(applicant).expect(403);
      await api()
        .post(notesUrl())
        .set(applicant)
        .send({ body: 'Hi' })
        .expect(403);
      await api().get(ratingUrl()).set(applicant).expect(403);
      await api()
        .put(ratingUrl())
        .set(applicant)
        .send({ rating: 5 })
        .expect(403);

      await api().get(notesUrl()).expect(401);
      await api().put(ratingUrl()).send({ rating: 5 }).expect(401);
    });

    it('returns 404 for an application that does not exist', async () => {
      for (const id of ['999999999', 'abc']) {
        const { body } = await api()
          .get(`/api/applications/${id}/notes`)
          .set(manager)
          .expect(404);
        expect(body.error).toBe('Application not found.');
        await api()
          .put(`/api/applications/${id}/rating`)
          .set(manager)
          .send({ rating: 4 })
          .expect(404);
      }
    });
  });
});
