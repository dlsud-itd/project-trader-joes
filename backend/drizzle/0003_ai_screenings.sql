CREATE TYPE "public"."screening_status" AS ENUM('completed', 'failed');--> statement-breakpoint
CREATE TABLE "ai_screenings" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"fit_score" integer,
	"explanation" text,
	"requirement_matches" jsonb,
	"status" "screening_status" NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"screened_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_screenings_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
ALTER TABLE "ai_screenings" ADD CONSTRAINT "ai_screenings_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;