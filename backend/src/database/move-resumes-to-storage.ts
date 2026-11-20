import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { ResumeStorage } from '../resumes/resume-storage.js';
import { hostOf } from './backup-file.js';
import { createPool } from './database.module.js';
import * as schema from './schema.js';
import { resumes } from './schema.js';

/**
 * One-time move of resumes still in the database (uploaded before Sprint 6)
 * into the Appwrite resumes bucket, then clears their bytes from the
 * database to free Neon storage. Each resume is moved on its own, so it is
 * safe to stop and run again; moved resumes are skipped.
 * Run with: npm run resumes:move-to-storage -- --yes
 * Without --yes it only shows what would happen.
 */
config();

const isConfirmed = process.argv.includes('--yes');
const connectionString = process.env.DATABASE_URL ?? '';
const storage = new ResumeStorage(new ConfigService(process.env));

if (!storage.isEnabled()) {
  console.error(
    'Set the APPWRITE_* variables in backend/.env first (see .env.example).',
  );
  process.exit(1);
}

const pool = createPool(connectionString);
const db = drizzle(pool, { schema });

try {
  const pending = await db
    .select({ id: resumes.id, file_name: resumes.file_name })
    .from(resumes)
    .where(and(isNull(resumes.storage_file_id), isNotNull(resumes.data)));

  console.log(
    `${pending.length} resume(s) in ${hostOf(connectionString)} to move.`,
  );
  if (!isConfirmed) {
    console.log('Run again with --yes to move them to Appwrite.');
  } else {
    for (const { id, file_name } of pending) {
      // Read one file at a time so a big database doesn't fill memory.
      const [file] = await db
        .select({ data: resumes.data })
        .from(resumes)
        .where(eq(resumes.id, id));
      if (!file?.data) continue;

      const fileId = storage.newFileId();
      await storage.upload(fileId, file.data, file_name);
      // Only clear the bytes once the file is safely in the bucket.
      await db
        .update(resumes)
        .set({ storage_file_id: fileId, data: null })
        .where(eq(resumes.id, id));
      console.log(`  Resume ${id} moved.`);
    }
    console.log(`Moved ${pending.length} resume(s) to Appwrite Storage.`);
  }
} finally {
  await pool.end();
}
