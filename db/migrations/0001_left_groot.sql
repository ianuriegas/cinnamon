CREATE TABLE "spotify_recently_played" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"track_id" text NOT NULL,
	"played_at" timestamp with time zone NOT NULL,
	"context_uri" text,
	"track_raw" jsonb NOT NULL,
	"context_raw" jsonb,
	"raw" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spotify_recently_played_user_played_at_unique" UNIQUE("user_id","played_at")
);
