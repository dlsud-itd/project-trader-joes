/**
 * The backup file written by `npm run db:backup` and read by
 * `npm run db:restore`: every table's rows as JSON, plus the last applied
 * migration so a restore only goes into a database with the same schema.
 */
import type { Pool } from 'pg';

export const BACKUP_FORMAT = 'talentflow-backup-v1';

export type BackupColumn = {
  name: string;
  /** Postgres data type from information_schema, e.g. `jsonb`, `bytea`. */
  type: string;
};

export type BackupTable = {
  name: string;
  columns: BackupColumn[];
  rows: Record<string, unknown>[];
};

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  created_at: string;
  /** Host of the database it came from, without the password. */
  source_host: string;
  /** Hash of the last applied Drizzle migration, or null if none. */
  last_migration: string | null;
  /** In insert order: tables come after the tables they reference. */
  tables: BackupTable[];
};

/** Bytes are stored as base64 so the whole backup stays plain JSON. */
type EncodedBytes = { $bytea: string };

const isEncodedBytes = (value: unknown): value is EncodedBytes =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as EncodedBytes).$bytea === 'string';

/** Turns a value read by `pg` into something JSON can hold. */
export function encodeValue(value: unknown): unknown {
  if (Buffer.isBuffer(value)) return { $bytea: value.toString('base64') };
  if (value instanceof Date) return value.toISOString();
  return value;
}

/** Turns a stored value back into a query parameter for its column. */
export function decodeValue(value: unknown, type: string): unknown {
  if (value === null) return null;
  if (isEncodedBytes(value)) return Buffer.from(value.$bytea, 'base64');
  // `pg` would send a JS array as a Postgres array, so JSON goes as text.
  if (type === 'json' || type === 'jsonb') return JSON.stringify(value);
  return value;
}

/**
 * Orders tables so each one comes after the tables it references, which is
 * the order rows can be inserted in. `references` holds [table, parent] pairs.
 */
export function sortByDependencies(
  tables: string[],
  references: [string, string][],
): string[] {
  const sorted: string[] = [];
  const visiting = new Set<string>();
  const visit = (table: string) => {
    if (sorted.includes(table)) return;
    if (visiting.has(table)) {
      throw new Error(`Tables reference each other in a loop: ${table}.`);
    }
    visiting.add(table);
    for (const [child, parent] of references) {
      if (child === table && parent !== table && tables.includes(parent)) {
        visit(parent);
      }
    }
    visiting.delete(table);
    sorted.push(table);
  };
  [...tables].sort().forEach(visit);
  return sorted;
}

/** Reads a backup file's text, checking it is one of ours. */
export function parseBackup(text: string): BackupFile {
  const backup = JSON.parse(text) as Partial<BackupFile>;
  if (backup.format !== BACKUP_FORMAT || !Array.isArray(backup.tables)) {
    throw new Error('This is not a TalentFlow backup file.');
  }
  return backup as BackupFile;
}

/** Quotes a table or column name for SQL. */
export const quoteName = (name: string) => `"${name.replaceAll('"', '""')}"`;

/** Hash of the newest Drizzle migration, or null on a fresh database. */
export async function lastMigration(db: Pool): Promise<string | null> {
  const { rows } = await db
    .query<{ hash: string }>(
      `SELECT hash FROM drizzle.__drizzle_migrations
       ORDER BY created_at DESC LIMIT 1`,
    )
    .catch(() => ({ rows: [] as { hash: string }[] }));
  return rows[0]?.hash ?? null;
}

/** The host part of a connection string, never the password. */
export function hostOf(connectionString: string): string {
  try {
    return new URL(connectionString).host;
  } catch {
    return 'unknown host';
  }
}
