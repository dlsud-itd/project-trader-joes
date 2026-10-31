import bcrypt from 'bcryptjs';
import { count } from 'drizzle-orm';
import { pathToFileURL } from 'node:url';
import type { Database } from './database.module.js';
import { users } from './schema.js';

/**
 * Inserts the sample accounts listed in the root README when the database is empty.
 * Safe to run more than once: it does nothing if any user already exists.
 */
export async function seedDatabase(db: Database): Promise<boolean> {
  const [{ total }] = await db.select({ total: count() }).from(users);
  if (total > 0) return false;

  await db.insert(users).values([
    {
      email: 'manager@talentflow.dev',
      password_hash: await bcrypt.hash('Manager123!', 10),
      first_name: 'Maria',
      last_name: 'Santos',
      role: 'manager',
    },
    {
      email: 'recruiter@talentflow.dev',
      password_hash: await bcrypt.hash('Recruiter123!', 10),
      first_name: 'Juan',
      last_name: 'Reyes',
      role: 'recruiter',
    },
    {
      email: 'applicant@talentflow.dev',
      password_hash: await bcrypt.hash('Applicant123!', 10),
      first_name: 'Ana',
      last_name: 'Cruz',
      role: 'applicant',
    },
  ]);
  return true;
}

/* Allows `npm run db:seed` to run this file directly. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { config } = await import('dotenv');
  config();
  const { createPool } = await import('./database.module.js');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const schema = await import('./schema.js');
  const pool = createPool(process.env.DATABASE_URL ?? '');
  const seeded = await seedDatabase(drizzle(pool, { schema }));
  console.log(
    seeded
      ? 'Seeded sample accounts.'
      : 'Skipped seeding: the database already has users.',
  );
  await pool.end();
}
