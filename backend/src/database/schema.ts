import { relations } from 'drizzle-orm';
import {
  customType,
  index,
  integer,
  jsonb,
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

/**
 * `open` accepts applications and shows on the careers page;
 * `closed` stops intake.
 */
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

/** Pipeline stages from the API specification (IV.B), in board order. */
export const kanbanStageEnum = pgEnum('kanban_stage', [
  'Applied',
  'Screening',
  'Interview',
  'Offer',
  'Rejected',
]);

/** One candidate applying to one job posting. */
export const applications = pgTable(
  'applications',
  {
    id: serial('id').primaryKey(),
    job_posting_id: integer('job_posting_id')
      .notNull()
      .references(() => jobPostings.id, { onDelete: 'restrict' }),
    kanban_stage: kanbanStageEnum('kanban_stage').notNull().default('Applied'),
    submitted_at: timestamp('submitted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('applications_job_posting_idx').on(t.job_posting_id)],
);

/** What the candidate typed into the careers page form. One per application. */
export const applicantProfiles = pgTable(
  'applicant_profiles',
  {
    id: serial('id').primaryKey(),
    application_id: integer('application_id')
      .notNull()
      .unique()
      .references(() => applications.id, { onDelete: 'cascade' }),
    full_name: varchar('full_name', { length: 150 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 30 }),
    portfolio_url: varchar('portfolio_url', { length: 255 }),
    cover_note: text('cover_note'),
    created_at: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('applicant_profiles_email_idx').on(t.email)],
);

/** Postgres `bytea`: raw file bytes, read and written as a Buffer. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});

/**
 * The uploaded resume file. The bytes live in the database because Render's
 * disk is wiped on every deploy. `extracted_text` and `parsed_data_json` are
 * filled in by AI screening (Sprint 3).
 */
export const resumes = pgTable('resumes', {
  id: serial('id').primaryKey(),
  application_id: integer('application_id')
    .notNull()
    .unique()
    .references(() => applications.id, { onDelete: 'cascade' }),
  /** Where staff download the file: /api/resumes/:id/file */
  file_url: varchar('file_url', { length: 255 }).notNull(),
  file_name: varchar('file_name', { length: 255 }).notNull(),
  mime_type: varchar('mime_type', { length: 100 }).notNull(),
  size_bytes: integer('size_bytes').notNull(),
  data: bytea('data').notNull(),
  extracted_text: text('extracted_text'),
  parsed_data_json: jsonb('parsed_data_json'),
  uploaded_at: timestamp('uploaded_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const applicationsRelations = relations(applications, ({ one }) => ({
  posting: one(jobPostings, {
    fields: [applications.job_posting_id],
    references: [jobPostings.id],
  }),
  profile: one(applicantProfiles),
  resume: one(resumes),
}));

export const applicantProfilesRelations = relations(
  applicantProfiles,
  ({ one }) => ({
    application: one(applications, {
      fields: [applicantProfiles.application_id],
      references: [applications.id],
    }),
  }),
);

export const resumesRelations = relations(resumes, ({ one }) => ({
  application: one(applications, {
    fields: [resumes.application_id],
    references: [applications.id],
  }),
}));

export type Application = typeof applications.$inferSelect;
export type KanbanStage = (typeof kanbanStageEnum.enumValues)[number];
export type ApplicantProfile = typeof applicantProfiles.$inferSelect;
export type Resume = typeof resumes.$inferSelect;
