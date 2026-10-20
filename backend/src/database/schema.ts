import { pgEnum, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';

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
