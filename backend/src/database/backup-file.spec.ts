import {
  BACKUP_FORMAT,
  decodeValue,
  encodeValue,
  hostOf,
  parseBackup,
  quoteName,
  sortByDependencies,
} from './backup-file.js';

describe('encodeValue / decodeValue', () => {
  it('keeps file bytes as base64 and turns them back into a Buffer', () => {
    const pdf = Buffer.from('%PDF-1.7 bytes');
    const stored = JSON.parse(JSON.stringify(encodeValue(pdf)));

    expect(stored).toEqual({ $bytea: pdf.toString('base64') });
    expect(decodeValue(stored, 'bytea')).toEqual(pdf);
  });

  it('writes dates as ISO text', () => {
    const date = new Date('2026-11-06T01:02:03.000Z');
    expect(encodeValue(date)).toBe('2026-11-06T01:02:03.000Z');
  });

  it('sends JSON columns as text so arrays stay JSON', () => {
    const matches = [{ requirement: 'SQL', match: 'met', evidence: '' }];
    expect(decodeValue(matches, 'jsonb')).toBe(JSON.stringify(matches));
  });

  it('leaves other values alone', () => {
    expect(encodeValue(42)).toBe(42);
    expect(decodeValue('Applied', 'USER-DEFINED')).toBe('Applied');
    expect(decodeValue(null, 'jsonb')).toBeNull();
  });
});

describe('sortByDependencies', () => {
  it('puts each table after the tables it references', () => {
    const order = sortByDependencies(
      ['resumes', 'applications', 'users', 'job_postings', 'ai_screenings'],
      [
        ['job_postings', 'users'],
        ['applications', 'job_postings'],
        ['resumes', 'applications'],
        ['ai_screenings', 'applications'],
      ],
    );
    const before = (a: string, b: string) =>
      expect(order.indexOf(a)).toBeLessThan(order.indexOf(b));
    before('users', 'job_postings');
    before('job_postings', 'applications');
    before('applications', 'resumes');
    before('applications', 'ai_screenings');
    expect(order).toHaveLength(5);
  });

  it('ignores a table that references itself', () => {
    expect(sortByDependencies(['users'], [['users', 'users']])).toEqual([
      'users',
    ]);
  });

  it('refuses tables that reference each other in a loop', () => {
    expect(() =>
      sortByDependencies(
        ['a', 'b'],
        [
          ['a', 'b'],
          ['b', 'a'],
        ],
      ),
    ).toThrow(/loop/);
  });
});

describe('parseBackup', () => {
  it('reads a backup file', () => {
    const text = JSON.stringify({ format: BACKUP_FORMAT, tables: [] });
    expect(parseBackup(text).tables).toEqual([]);
  });

  it('rejects other JSON files', () => {
    expect(() => parseBackup('{"name":"package"}')).toThrow(
      /not a TalentFlow backup/,
    );
  });
});

describe('quoteName / hostOf', () => {
  it('quotes names for SQL', () => {
    expect(quoteName('job_postings')).toBe('"job_postings"');
    expect(quoteName('we"ird')).toBe('"we""ird"');
  });

  it('shows the host but never the password', () => {
    const url = 'postgresql://owner:s3cret@ep-x.neon.tech/talentflow';
    expect(hostOf(url)).toBe('ep-x.neon.tech');
    expect(hostOf('not a url')).toBe('unknown host');
  });
});
