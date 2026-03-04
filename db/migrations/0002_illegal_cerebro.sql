CREATE TABLE "spotify_top_tracks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"track_id" text NOT NULL,
	"time_range" text NOT NULL,
	"rank" integer NOT NULL,
	"snapshot_date" date NOT NULL,
	"track_raw" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spotify_top_tracks_user_track_snapshot_unique" UNIQUE("user_id","track_id","time_range","snapshot_date")
);
