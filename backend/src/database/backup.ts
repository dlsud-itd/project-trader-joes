import { config } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Pool } from 'pg';
import {
  BACKUP_FORMAT,
  type BackupFile,
  type BackupTable,
  encodeValue,
  hostOf,
  lastMigration,
  quoteName,
  sortByDependencies,
} from './backup-file.js';
import { createPool } from './database.module.js';

/**
 * Saves a full copy of the database in backend/.env to
 * backend/backups/talentflow-<date>.json. The file holds applicants'
 * personal data and password hashes: keep it private and never commit it.
 * Run with: npm run db:backup (restore with npm run db:restore).
 */
config();

const connectionString = process.env.DATABASE_URL ?? '';
const pool = createPool(connectionString);

try {
  const backup = await readDatabase(pool);
  const folder = resolve(process.cwd(), 'backups');
  await mkdir(folder, { recursive: true });
  const stamp = backup.created_at.slice(0, 16).replace(/[-:T]/g, '');
  const file = resolve(folder, `talentflow-${stamp}.json`);
  await writeFile(file, JSON.stringify(backup));

  console.log(`Backed up ${backup.source_host}:`);
  for (const table of backup.tables) {
    console.log(`  ${table.name}: ${table.rows.length} rows`);
  }
  console.log(`Saved to ${file}`);
  console.log('It has personal data. Keep it private; never commit it.');
} catch (error) {
  console.error('Backup failed:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}

async function readDatabase(db: Pool): Promise<BackupFile> {
  const { rows: tableRows } = await db.query<{ name: string }>(
    `SELECT table_name AS name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  );
  const { rows: references } = await db.query<{
    child: string;
    parent: string;
  }>(
    `SELECT c.conrelid::regclass::text AS child,
            c.confrelid::regclass::text AS parent
     FROM pg_constraint c
     JOIN pg_namespace n ON n.oid = c.connamespace
     WHERE c.contype = 'f' AND n.nspname = 'public'`,
  );
  const order = sortByDependencies(
    tableRows.map((t) => t.name),
    references.map((r) => [unquote(r.child), unquote(r.parent)]),
  );

  const tables: BackupTable[] = [];
  for (const name of order) {
    const { rows: columns } = await db.query<{ name: string; type: string }>(
      `SELECT column_name AS name, data_type AS type
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [name],
    );
    const { rows } = await db.query<Record<string, unknown>>(
      `SELECT * FROM ${quoteName(name)} ORDER BY 1`,
    );
    tables.push({
      name,
      columns,
      rows: rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [key, encodeValue(value)]),
        ),
      ),
    });
  }

  return {
    format: BACKUP_FORMAT,
    created_at: new Date().toISOString(),
    source_host: hostOf(connectionString),
    last_migration: await lastMigration(db),
    tables,
  };
}

/** `regclass::text` quotes names that need it; the backup stores them bare. */
function unquote(name: string): string {
  return name.replace(/^"(.*)"$/, '$1').replaceAll('""', '"');
}
