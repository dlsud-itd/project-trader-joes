CREATE TYPE "public"."kanban_stage" AS ENUM('Applied', 'Screening', 'Interview', 'Offer', 'Rejected');--> statement-breakpoint
CREATE TABLE "applicant_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"full_name" varchar(150) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(30),
	"portfolio_url" varchar(255),
	"cover_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applicant_profiles_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_posting_id" integer NOT NULL,
	"kanban_stage" "kanban_stage" DEFAULT 'Applied' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resumes" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"file_url" varchar(255) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"extracted_text" text,
	"parsed_data_json" jsonb,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resumes_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
ALTER TABLE "applicant_profiles" ADD CONSTRAINT "applicant_profiles_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_posting_id_job_postings_id_fk" FOREIGN KEY ("job_posting_id") REFERENCES "public"."job_postings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applicant_profiles_email_idx" ON "applicant_profiles" USING btree ("email");--> statement-breakpoint
CREATE INDEX "applications_job_posting_idx" ON "applications" USING btree ("job_posting_id");