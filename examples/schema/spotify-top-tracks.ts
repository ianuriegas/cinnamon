import {
  date,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const spotifyTopTracks = pgTable(
  "spotify_top_tracks",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    trackId: text("track_id").notNull(),
    timeRange: text("time_range").notNull(),
    rank: integer("rank").notNull(),
    snapshotDate: date("snapshot_date").notNull(),
    trackRaw: jsonb("track_raw").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userTrackSnapshotUnique: unique("spotify_top_tracks_user_track_snapshot_unique").on(
      table.userId,
      table.trackId,
      table.timeRange,
      table.snapshotDate,
    ),
  }),
);
