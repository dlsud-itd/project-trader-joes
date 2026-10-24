import {
  BadRequestException,
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

  private async getRow(id: number): Promise<JobPosting> {
    const row = await this.db.query.jobPostings.findFirst({
      where: eq(jobPostings.id, id),
    });
    if (!row) throw new NotFoundException('Job posting not found.');
    return row;
  }
}
