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
import {
  RESUME_MAX_BYTES,
  RESUME_MIME_TYPE,
} from '../src/resumes/resume-file.js';
import { buildPdf } from './resume-files.js';

/**
 * Runs against the database in backend/.env (seeded sample accounts required).
 * The posting and applications created here are deleted afterwards.
 * Run with: npm run test:e2e
 */
describe('Resumes (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let manager: { Authorization: string };
  let postingId: number;

  const pdf = Buffer.from('%PDF-1.7\n1 0 obj << >> endobj\n%%EOF\n');
  const api = () => request(app.getHttpServer());

  /**
   * Creates an application straight in the database and signs its upload
   * token the same way POST /api/applications does, so these tests don't
   * depend on the applications endpoint.
   */
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

  const upload = (
    applicationId: number,
    token: string,
    file: Buffer,
    name = 'Juan CV.pdf',
  ) =>
    api()
      .post('/api/resumes')
      .field('application_id', String(applicationId))
      .field('upload_token', token)
      .attach('file', file, name);

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

    const created = await api()
      .post('/api/job-postings')
      .set(manager)
      .send({
        title: 'E2E Resume Uploads',
        department: 'IT',
        location: 'Cavite',
        description: 'Posting created by the resumes e2e test.',
        requirements: 'JavaScript',
      })
      .expect(201);
    postingId = created.body.job_posting.id;
  });

  afterAll(async () => {
    if (postingId) {
      // Resumes are removed with their application (cascade).
      await db
        .delete(applications)
        .where(eq(applications.job_posting_id, postingId));
      await db.delete(jobPostings).where(eq(jobPostings.id, postingId));
    }
    await app.close();
  });

  it('stores a PDF and lets staff download the same bytes', async () => {
    const { id, token } = await apply();
    const { body } = await upload(id, token, pdf).expect(201);

    expect(body.message).toBe('Resume uploaded successfully.');
    expect(body.resume).toMatchObject({
      application_id: id,
      file_name: 'Juan CV.pdf',
      mime_type: RESUME_MIME_TYPE,
      size_bytes: pdf.length,
      file_url: `/api/resumes/${body.resume.id}/file`,
    });
    expect(body.resume).not.toHaveProperty('data');

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
    expect(download.headers['content-disposition']).toContain('Juan%20CV.pdf');
    expect(Buffer.compare(download.body as Buffer, pdf)).toBe(0);
  });

  it('rejects a Word (.docx) file (400)', async () => {
    const { id, token } = await apply();
    const docx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    const { body } = await upload(id, token, docx, 'Juan CV.docx').expect(400);
    expect(body.error).toBe('Upload a PDF file.');
  });

  /** The text saved for AI screening, read straight from the database. */
  const extractedText = async (resumeId: number) => {
    const [row] = await db
      .select({ extracted_text: resumes.extracted_text })
      .from(resumes)
      .where(eq(resumes.id, resumeId));
    return row.extracted_text;
  };

  it('reads the text of an uploaded PDF for screening', async () => {
    const { id, token } = await apply();
    const file = buildPdf(['Juan Dela Cruz', 'SKILLS: JavaScript']);
    const { body } = await upload(id, token, file).expect(201);
    expect(body.resume).not.toHaveProperty('extracted_text');
    expect(await extractedText(body.resume.id)).toBe(
      'Juan Dela Cruz\nSKILLS: JavaScript',
    );
  });

  it('still accepts a file whose text cannot be read', async () => {
    const { id, token } = await apply();
    const { body } = await upload(id, token, pdf).expect(201);
    expect(await extractedText(body.resume.id)).toBeNull();
  });

  it('keeps downloads behind sign-in (401)', async () => {
    const { id, token } = await apply();
    const { body } = await upload(id, token, pdf).expect(201);
    await api().get(body.resume.file_url).expect(401);
  });

  it('allows only one resume per application (409)', async () => {
    const { id, token } = await apply();
    await upload(id, token, pdf).expect(201);
    await upload(id, token, pdf).expect(409);
  });

  it("rejects another application's upload token (403)", async () => {
    const first = await apply();
    const second = await apply();
    await upload(second.id, first.token, pdf).expect(403);
  });

  it('rejects files that only pretend to be a PDF (400)', async () => {
    const { id, token } = await apply();
    const { body } = await upload(
      id,
      token,
      Buffer.from('just some text'),
      'resume.pdf',
    ).expect(400);
    expect(body.error).toBe('Upload a PDF file.');
  });

  it('rejects a request without a file (400)', async () => {
    const { id, token } = await apply();
    const { body } = await api()
      .post('/api/resumes')
      .field('application_id', String(id))
      .field('upload_token', token)
      .expect(400);
    expect(body.error).toBe('Invalid or missing resume document.');
  });

  it('returns 404 for an unknown resume id', async () => {
    const unknownResumeId = 999_999;
    const { body } = await api()
      .get(`/api/resumes/${unknownResumeId}/file`)
      .set(manager)
      .expect(404);
    expect(body.error).toBe('Resume not found.');
  });

  it('rejects files over 5 MB (413)', async () => {
    const { id, token } = await apply();
    const big = Buffer.concat([pdf, Buffer.alloc(RESUME_MAX_BYTES)]);
    await upload(id, token, big).expect(413);
  });
});
