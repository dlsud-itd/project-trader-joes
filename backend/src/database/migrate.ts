import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { resolve } from 'node:path';
import { createPool } from './database.module.js';
import * as schema from './schema.js';
import { seedDatabase } from './seed.js';

/**
 * Applies pending SQL migrations from /drizzle, then seeds sample data
 * if the database is empty. Runs before the server starts in production.
 */
config();

const pool = createPool(process.env.DATABASE_URL ?? '');
const db = drizzle(pool, { schema });

try {
  await migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') });
  console.log('Migrations applied.');
  if (await seedDatabase(db)) console.log('Seeded sample data.');
} catch (error) {
  console.error('Migration failed:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
