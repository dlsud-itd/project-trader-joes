import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { DB, type Database } from '../database/database.module.js';
import {
  type JobPosting,
  type JobPostingStatus,
  jobPostings,
  users,
} from '../database/schema.js';
import type { CreateJobPostingDto } from './dto/create-job-posting.dto.js';
import type { ListJobPostingsQuery } from './dto/list-job-postings.query.js';
import type { UpdateJobPostingDto } from './dto/update-job-posting.dto.js';

export interface PostingAuthor {
  id: number;
  first_name: string;
  last_name: string;
}

/** What staff see: the full row plus who created it. */
export type StaffJobPosting = JobPosting & { author: PostingAuthor | null };

/** What visitors see on the careers page: no internal fields. */
export type PublicJobPosting = Omit<JobPosting, 'created_by' | 'updated_at'>;

/**
 * Postgres refused the delete because another row still points to it:
 * 23001 for ON DELETE RESTRICT, 23503 for NO ACTION. Drizzle wraps the
 * driver's error, so the code may be on `cause`.
 */
const REFERENCED_ROW_CODES = new Set(['23001', '23503']);

function isForeignKeyViolation(err: unknown): boolean {
  const code = (e: unknown) => (e as { code?: unknown } | null)?.code;
  return [code(err), code((err as { cause?: unknown })?.cause)].some(
    (c: unknown) => typeof c === 'string' && REFERENCED_ROW_CODES.has(c),
  );
}

/** Escapes LIKE wildcards so a search for "50%" matches literally. */
const likePattern = (term: string) => `%${term.replace(/[\\%_]/g, '\\$&')}%`;

@Injectable()
export class JobPostingsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  static toPublic({
    created_by: _by,
    updated_at: _updated,
    ...posting
  }: JobPosting): PublicJobPosting {
    return posting;
  }

  /**
   * Newest first. `staff = false` limits the result to open postings,
   * whatever status the caller asked for.
   */
  async findAll(
    query: ListJobPostingsQuery,
    staff: boolean,
  ): Promise<StaffJobPosting[] | PublicJobPosting[]> {
    const filters: SQL[] = [];
    const status: JobPostingStatus | undefined = staff ? query.status : 'open';
    if (status) filters.push(eq(jobPostings.status, status));
    if (query.q) {
      const pattern = likePattern(query.q);
      filters.push(
        or(
          ilike(jobPostings.title, pattern),
          ilike(jobPostings.department, pattern),
          ilike(jobPostings.location, pattern),
        )!,
      );
    }

    const rows = await this.db
      .select({
        posting: jobPostings,
        author: {
          id: users.id,
          first_name: users.first_name,
          last_name: users.last_name,
        },
      })
      .from(jobPostings)
      .leftJoin(users, eq(users.id, jobPostings.created_by))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(jobPostings.created_at), desc(jobPostings.id));

    return staff
      ? rows.map(({ posting, author }) => ({ ...posting, author }))
      : rows.map(({ posting }) => JobPostingsService.toPublic(posting));
  }

  /** Visitors only see open postings; a closed one looks the same as a missing one. */
  async findOne(
    id: number,
    staff: boolean,
  ): Promise<StaffJobPosting | PublicJobPosting> {
    const [row] = await this.db
      .select({
        posting: jobPostings,
        author: {
          id: users.id,
          first_name: users.first_name,
          last_name: users.last_name,
        },
      })
      .from(jobPostings)
      .leftJoin(users, eq(users.id, jobPostings.created_by))
      .where(eq(jobPostings.id, id));

    if (!row || (!staff && row.posting.status !== 'open')) {
      throw new NotFoundException('Job posting not found.');
    }
    return staff
      ? { ...row.posting, author: row.author }
      : JobPostingsService.toPublic(row.posting);
  }

  async create(dto: CreateJobPostingDto, userId: number): Promise<JobPosting> {
    const [created] = await this.db
      .insert(jobPostings)
      .values({ ...dto, status: dto.status ?? 'open', created_by: userId })
      .returning();
    return created;
  }

  async update(id: number, dto: UpdateJobPostingDto): Promise<JobPosting> {
    // Optional fields skip validation when null, but every column is required.
    const cleared = Object.entries(dto)
      .filter(([, value]) => value === null)
      .map(([key]) => key);
    if (cleared.length) {
      throw new BadRequestException(
        `These fields can't be empty: ${cleared.join(', ')}.`,
      );
    }
    if (Object.keys(dto).length === 0) {
      return this.getRow(id);
    }
    const [updated] = await this.db
      .update(jobPostings)
      .set(dto)
      .where(eq(jobPostings.id, id))
      .returning();
    if (!updated) throw new NotFoundException('Job posting not found.');
    return updated;
  }

  setStatus(id: number, status: JobPostingStatus): Promise<JobPosting> {
    return this.update(id, { status });
  }

  /**
   * Deletes a posting nobody has applied to. Applications keep their posting
   * (the foreign key blocks the delete), so those postings must be closed.
   */
  async remove(id: number): Promise<void> {
    let deleted: { id: number }[];
    try {
      deleted = await this.db
        .delete(jobPostings)
        .where(eq(jobPostings.id, id))
        .returning({ id: jobPostings.id });
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        throw new ConflictException(
          'This posting has applicants, so it can’t be deleted. Close it instead.',
        );
      }
      throw err;
    }
    if (!deleted.length) throw new NotFoundException('Job posting not found.');
  }

  private async getRow(id: number): Promise<JobPosting> {
    const row = await this.db.query.jobPostings.findFirst({
      where: eq(jobPostings.id, id),
    });
    if (!row) throw new NotFoundException('Job posting not found.');
    return row;
  }
}
