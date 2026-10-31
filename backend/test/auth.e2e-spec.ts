import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import 'dotenv/config';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';

/**
 * Runs against the database in backend/.env.
 * Seed it with `npm run db:seed`.
 * Run with: npm run test:e2e
 */
type Credentials = { email: string; password: string };

const MANAGER: Credentials = {
  email: 'manager@talentflow.dev',
  password: 'Manager123!',
};
const RECRUITER: Credentials = {
  email: 'recruiter@talentflow.dev',
  password: 'Recruiter123!',
};

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const login = (credentials: Credentials) =>
    request(app.getHttpServer()).post('/api/auth/login').send(credentials);

  it('GET /api/health reports the database is up', () =>
    request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => expect(res.body.database).toBe('up')));

  it('logs in with valid credentials', async () => {
    const res = await login(MANAGER).expect(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.role).toBe('manager');
  });

  it('rejects invalid credentials with 401', async () => {
    const res = await login({ ...MANAGER, password: 'wrong' }).expect(401);
    expect(res.body).toEqual({ error: 'Invalid email or password' });
  });

  it('blocks /api/auth/me without a token', () =>
    request(app.getHttpServer()).get('/api/auth/me').expect(401));

  it('lets a recruiter read /api/auth/me but not register users', async () => {
    const { body } = await login(RECRUITER);
    const auth = { Authorization: `Bearer ${body.token}` };

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set(auth)
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .set(auth)
      .send({
        email: 'new@talentflow.dev',
        password: 'Password123',
        first_name: 'New',
        last_name: 'User',
        role: 'recruiter',
      })
      .expect(403);
  });

  it('validates the register body for managers', async () => {
    const { body } = await login(MANAGER);
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .set({ Authorization: `Bearer ${body.token}` })
      .send({ email: 'not-an-email', password: 'short', role: 'admin' })
      .expect(400);
    expect(res.body.details).toEqual(expect.any(Array));
  });

  it('registers a user and rejects duplicate emails', async () => {
    const { body } = await login(MANAGER);
    const auth = { Authorization: `Bearer ${body.token}` };
    const uniqueEmail = `staff_${Date.now()}@talentflow.dev`;
    const payload = {
      email: uniqueEmail,
      password: 'Password123!',
      first_name: 'Test',
      last_name: 'User',
      role: 'recruiter',
    };

    // 1. Manager registers a user successfully (201)
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .set(auth)
      .send(payload)
      .expect(201);

    expect(res.body.user).toHaveProperty('email', uniqueEmail);

    // 2. Attempting to register with the exact same email gives 409 Conflict
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .set(auth)
      .send(payload)
      .expect(409);
  });
});
