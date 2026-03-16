CREATE SCHEMA "cinnamon";
--> statement-breakpoint
CREATE TABLE "cinnamon"."api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"key_hash" text NOT NULL,
	"label" text,
	"revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "cinnamon"."jobs_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer,
	"job_id" text NOT NULL,
	"queue_name" text NOT NULL,
	"job_name" text NOT NULL,
	"status" text NOT NULL,
	"payload" jsonb,
	"result" jsonb,
	"logs" text,
	"error" boolean DEFAULT false NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_log_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "cinnamon"."teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cinnamon"."api_keys" ADD CONSTRAINT "api_keys_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "cinnamon"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinnamon"."jobs_log" ADD CONSTRAINT "jobs_log_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "cinnamon"."teams"("id") ON DELETE no action ON UPDATE no action;