import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DB, type Database } from '../database/database.module.js';
import {
  type JobAssignment,
  jobAssignments,
  jobPostings,
  users,
} from '../database/schema.js';
import { CreateJobAssignmentDto } from './dto/create-job-assignment.dto.js';

/** The assigned recruiter, as shown next to a posting. */
export type AssignedUser = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
};

/** One assignment in GET /api/job-assignments. */
export type JobAssignmentListItem = JobAssignment & { user: AssignedUser };

const DUPLICATE_MESSAGE = 'User is already assigned to this job posting.';
export const ASSIGNMENT_NOT_FOUND = 'Assignment not found.';

/** Postgres error code for a unique constraint violation. */
const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(err: unknown): boolean {
  const code = (e: unknown) => (e as { code?: unknown } | null)?.code;
  return [code(err), code((err as { cause?: unknown })?.cause)].includes(
    UNIQUE_VIOLATION,
  );
}

@Injectable()
export class JobAssignmentsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Every assignment with the recruiter's name, oldest first. */
  async findAll(): Promise<JobAssignmentListItem[]> {
    return this.db.query.jobAssignments.findMany({
      with: {
        user: {
          columns: { id: true, first_name: true, last_name: true, email: true },
        },
      },
      orderBy: [asc(jobAssignments.assigned_at), asc(jobAssignments.id)],
    });
  }

  /** Assigns a recruiter to a posting (API spec III.A). */
  async assign({
    job_posting_id,
    user_id,
  }: CreateJobAssignmentDto): Promise<JobAssignment> {
    const posting = await this.db.query.jobPostings.findFirst({
      where: eq(jobPostings.id, job_posting_id),
      columns: { id: true },
    });
    if (!posting) throw new NotFoundException('Job posting not found.');

    const user = await this.db.query.users.findFirst({
      where: eq(users.id, user_id),
      columns: { role: true },
    });
    if (!user) throw new NotFoundException('User not found.');
    if (user.role !== 'recruiter') {
      throw new BadRequestException(
        'Only recruiters can be assigned to job postings.',
      );
    }

    try {
      const [created] = await this.db
        .insert(jobAssignments)
        .values({ job_posting_id, user_id })
        .returning();
      return created;
    } catch (err) {
      // The unique constraint also covers two managers assigning at once.
      if (isUniqueViolation(err)) {
        throw new ConflictException(DUPLICATE_MESSAGE);
      }
      throw err;
    }
  }

  /** Takes a recruiter off a posting. */
  async remove(id: number): Promise<void> {
    const [removed] = await this.db
      .delete(jobAssignments)
      .where(eq(jobAssignments.id, id))
      .returning({ id: jobAssignments.id });
    if (!removed) throw new NotFoundException(ASSIGNMENT_NOT_FOUND);
  }
}
