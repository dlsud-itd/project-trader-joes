import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { signUploadToken } from '../src/common/upload-token/upload-token.js';
import { DB, type Database } from '../src/database/database.module.js';
import { applications, jobPostings, resumes } from '../src/database/schema.js';
import { ResumeStorage } from '../src/resumes/resume-storage.js';
import { ResumeTextService } from '../src/resumes/resume-text.service.js';
import { FakeResumeStorage } from './fake-resume-storage.js';
import { buildPdf } from './resume-files.js';

/**
 * Resume uploads with Appwrite Storage switched on, using a fake bucket so no
 * Appwrite project is needed. Same API as before: only where the file is
 * kept changes. Runs against the database in backend/.env.
 */
describe('Resumes in Appwrite Storage (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let manager: { Authorization: string };
  let postingId: number;
  const bucket = new FakeResumeStorage();

  const api = () => request(app.getHttpServer());

  const apply = async () => {
    const [created] = await db
      .insert(applications)
      .values({ job_posting_id: postingId })
      .returning({ id: applications.id });
    return {
      id: created.id,
      token: signUploadToken(created.id, process.env.JWT_SECRET ?? ''),
    };
  };

  const upload = (applicationId: number, token: string, file: Buffer) =>
    api()
      .post('/api/resumes')
      .field('application_id', String(applicationId))
      .field('upload_token', token)
      .attach('file', file, 'Ana Cruz CV.pdf');

  const row = async (resumeId: number) => {
    const [found] = await db
      .select({
        fileId: resumes.storage_file_id,
        data: resumes.data,
        text: resumes.extracted_text,
      })
      .from(resumes)
      .where(eq(resumes.id, resumeId));
    return found;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ResumeStorage)
      .useValue(bucket)
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
        title: 'E2E Resume Storage',
        department: 'IT',
        location: 'Cavite',
        description: 'Posting created by the resume storage e2e test.',
        requirements: 'JavaScript',
      })
      .expect(201);
    postingId = created.body.job_posting.id;
  });

  afterAll(async () => {
    if (postingId) {
      await db
        .delete(applications)
        .where(eq(applications.job_posting_id, postingId));
      await db.delete(jobPostings).where(eq(jobPostings.id, postingId));
    }
    await app.close();
  });

  it('keeps the PDF in the bucket, not the database', async () => {
    const { id, token } = await apply();
    const file = buildPdf(['Ana Cruz', 'SKILLS: TypeScript']);
    const { body } = await upload(id, token, file).expect(201);

    const saved = await row(body.resume.id);
    expect(saved.data).toBeNull();
    expect(saved.fileId).toEqual(expect.any(String));
    expect(bucket.files.get(saved.fileId as string)?.name).toBe(
      'Ana Cruz CV.pdf',
    );
    // Text for AI screening is still read on upload.
    expect(saved.text).toBe('Ana Cruz\nSKILLS: TypeScript');
  });

  it('serves the same bytes from the bucket to staff', async () => {
    const { id, token } = await apply();
    const file = buildPdf(['Same bytes']);
    const { body } = await upload(id, token, file).expect(201);

    const download = await api()
      .get(body.resume.file_url)
      .set(manager)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(download.headers['content-type']).toBe('application/pdf');
    expect(Buffer.compare(download.body as Buffer, file)).toBe(0);
  });

  it('reads the text again from the bucket before screening', async () => {
    const { id, token } = await apply();
    const { body } = await upload(id, token, buildPdf(['Again'])).expect(201);
    await db
      .update(resumes)
      .set({ extracted_text: null })
      .where(eq(resumes.id, body.resume.id));

    const text = await app.get(ResumeTextService).extractStored(body.resume.id);
    expect(text).toBe('Again');
  });

  it('saves nothing when the bucket upload fails', async () => {
    const { id, token } = await apply();
    bucket.failNextUpload = true;
    await upload(id, token, buildPdf(['Down'])).expect(500);

    const found = await db
      .select({ id: resumes.id })
      .from(resumes)
      .where(eq(resumes.application_id, id));
    expect(found).toEqual([]);
  });

  it('still downloads resumes saved in the database before the move', async () => {
    const { id } = await apply();
    const old = buildPdf(['Old upload']);
    const [created] = await db
      .insert(resumes)
      .values({
        application_id: id,
        file_url: '',
        file_name: 'old.pdf',
        mime_type: 'application/pdf',
        size_bytes: old.length,
        data: old,
      })
      .returning({ id: resumes.id });

    const download = await api()
      .get(`/api/resumes/${created.id}/file`)
      .set(manager)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(Buffer.compare(download.body as Buffer, old)).toBe(0);
  });

  it('refuses a resume row with no file at all', async () => {
    const { id } = await apply();
    await expect(
      db.insert(resumes).values({
        application_id: id,
        file_url: '',
        file_name: 'empty.pdf',
        mime_type: 'application/pdf',
        size_bytes: 0,
      }),
    ).rejects.toThrow();
  });
});
