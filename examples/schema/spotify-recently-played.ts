import { jsonb, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

export const spotifyRecentlyPlayed = pgTable(
  "spotify_recently_played",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    trackId: text("track_id").notNull(),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
    contextUri: text("context_uri"),
    trackRaw: jsonb("track_raw").notNull(),
    contextRaw: jsonb("context_raw"),
    raw: jsonb("raw").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userPlayedAtUnique: unique("spotify_recently_played_user_played_at_unique").on(
      table.userId,
      table.playedAt,
    ),
  }),
);
