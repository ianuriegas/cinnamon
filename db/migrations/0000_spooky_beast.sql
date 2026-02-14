CREATE TABLE "jobs_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"queue_name" text NOT NULL,
	"job_name" text NOT NULL,
	"status" text NOT NULL,
	"payload" jsonb,
	"result" jsonb,
	"error" boolean DEFAULT false NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_log_job_id_unique" UNIQUE("job_id")
);
