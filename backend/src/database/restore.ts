import { config } from 'dotenv';
import { readFile } from 'node:fs/promises';
import type { Pool, PoolClient } from 'pg';
import {
  type BackupTable,
  decodeValue,
  hostOf,
  lastMigration,
  parseBackup,
  quoteName,
} from './backup-file.js';
import { createPool } from './database.module.js';

/**
 * Puts a backup from `npm run db:backup` back into the database in
 * backend/.env, replacing everything in it. Run `npm run db:migrate` on
 * that database first so its schema matches the backup.
 * Run with: npm run db:restore -- backups/talentflow-<date>.json --yes
 * Without --yes it only shows what would happen.
 */
config();

/** Rows per INSERT; keeps each query well under Postgres' parameter limit. */
const BATCH_ROWS = 100;

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith('--'));
const isConfirmed = args.includes('--yes');
const connectionString = process.env.DATABASE_URL ?? '';

if (!file) {
  console.error(
    'Usage: npm run db:restore -- backups/talentflow-<date>.json --yes',
  );
  process.exit(1);
}

const backup = parseBackup(await readFile(file, 'utf8'));
const pool = createPool(connectionString);

try {
  const target = hostOf(connectionString);
  console.log(`Backup from ${backup.source_host}, made ${backup.created_at}.`);
  for (const table of backup.tables) {
    console.log(`  ${table.name}: ${table.rows.length} rows`);
  }

  const targetMigration = await lastMigration(pool);
  if (targetMigration !== backup.last_migration) {
    throw new Error(
      `${target} is not on the same migration as the backup. ` +
        'Check out the code the backup was made with and run ' +
        '`npm run db:migrate` on that database first.',
    );
  }

  if (!isConfirmed) {
    console.log(
      `\nThis will DELETE everything in ${target} and replace it with the ` +
        'backup. Run again with --yes to go ahead.',
    );
  } else {
    await restore(pool, backup.tables);
    console.log(`\nRestored into ${target}.`);
  }
} catch (error) {
  console.error(
    'Restore failed:',
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}

/** Replaces every table's rows in one transaction, so it's all or nothing. */
async function restore(db: Pool, tables: BackupTable[]): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const names = tables.map((t) => quoteName(t.name)).join(', ');
    await client.query(`TRUNCATE ${names} RESTART IDENTITY CASCADE`);
    // The backup lists parents before children, so references are valid.
    for (const table of tables) await insertRows(client, table);
    for (const table of tables) await resetSequences(client, table.name);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function insertRows(client: PoolClient, table: BackupTable) {
  const columns = table.columns.map((c) => quoteName(c.name)).join(', ');
  for (let start = 0; start < table.rows.length; start += BATCH_ROWS) {
    const batch = table.rows.slice(start, start + BATCH_ROWS);
    const params: unknown[] = [];
    const tuples = batch.map((row) => {
      const slots = table.columns.map((column) => {
        params.push(decodeValue(row[column.name] ?? null, column.type));
        return `$${params.length}`;
      });
      return `(${slots.join(', ')})`;
    });
    await client.query(
      `INSERT INTO ${quoteName(table.name)} (${columns})
       VALUES ${tuples.join(', ')}`,
      params,
    );
  }
}

/** Moves each id counter past the restored rows, so new rows don't clash. */
async function resetSequences(client: PoolClient, table: string) {
  const { rows } = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
       AND column_default LIKE 'nextval(%'`,
    [table],
  );
  for (const { column_name } of rows) {
    const column = quoteName(column_name);
    await client.query(
      `SELECT setval(pg_get_serial_sequence($1, $2),
         COALESCE((SELECT MAX(${column}) FROM ${quoteName(table)}), 0) + 1,
         false)`,
      [quoteName(table), column_name],
    );
  }
}
