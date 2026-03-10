CREATE TABLE "api_key_teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"api_key_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	CONSTRAINT "api_key_teams_api_key_id_team_id_unique" UNIQUE("api_key_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "job_teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_name" text NOT NULL,
	"team_id" integer NOT NULL,
	CONSTRAINT "job_teams_job_name_team_id_unique" UNIQUE("job_name","team_id")
);
--> statement-breakpoint
CREATE TABLE "user_teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_teams_user_id_team_id_unique" UNIQUE("user_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"picture" text,
	"provider" text DEFAULT 'google' NOT NULL,
	"provider_sub" text,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "api_keys" RENAME COLUMN "label" TO "name";--> statement-breakpoint
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_team_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "last_used_at" timestamp;--> statement-breakpoint
ALTER TABLE "api_key_teams" ADD CONSTRAINT "api_key_teams_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key_teams" ADD CONSTRAINT "api_key_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_teams" ADD CONSTRAINT "job_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_teams" ADD CONSTRAINT "user_teams_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_teams" ADD CONSTRAINT "user_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" DROP COLUMN "team_id";--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_name_unique" UNIQUE("name");