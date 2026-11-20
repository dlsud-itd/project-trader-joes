ALTER TABLE "resumes" ALTER COLUMN "data" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "storage_file_id" varchar(64);--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_file_check" CHECK ("resumes"."storage_file_id" IS NOT NULL OR "resumes"."data" IS NOT NULL);