import { relations } from 'drizzle-orm';
import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * TalentFlow database schema (Drizzle ORM).
 * Based on "TalentFlow Database Schema V2" in /documents.
 *
 * Sprint 1 only adds `users`. Add the other tables (job_postings,
 * applications, resumes, ...) in the sprint that builds each feature,
 * then run `npm run db:generate` to create a migration for them.
 *
 * Column names are snake_case so API responses match the API specification.
 */

export const userRoleEnum = pgEnum('user_role', ['manager', 'recruiter']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password_hash: varchar('password_hash', { length: 255 }).notNull(),
  first_name: varchar('first_name', { length: 100 }).notNull(),
  last_name: varchar('last_name', { length: 100 }).notNull(),
  role: userRoleEnum('role').notNull().default('recruiter'),
  created_at: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type UserRole = (typeof userRoleEnum.enumValues)[number];

/* ---------------------------------------------------------------- Sprint 2 */

/** `open` accepts applications and shows on the careers page; `closed` stops intake. */
export const jobPostingStatusEnum = pgEnum('job_posting_status', [
  'open',
  'closed',
]);

export const jobPostings = pgTable(
  'job_postings',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 150 }).notNull(),
    department: varchar('department', { length: 100 }).notNull(),
    location: varchar('location', { length: 150 }).notNull(),
    description: text('description').notNull(),
    /**
     * One requirement per line. This is what the AI screening (Sprint 3)
     * scores resumes against, so each line should be a single criterion.
     */
    requirements: text('requirements').notNull(),
    status: jobPostingStatusEnum('status').notNull().default('open'),
    created_by: integer('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    created_at: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('job_postings_status_idx').on(t.status)],
);

export const jobPostingsRelations = relations(jobPostings, ({ one }) => ({
  author: one(users, {
    fields: [jobPostings.created_by],
    references: [users.id],
  }),
}));

export type JobPosting = typeof jobPostings.$inferSelect;
export type JobPostingStatus = (typeof jobPostingStatusEnum.enumValues)[number];
