import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { teams } from "./teams.ts";

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id),
  keyHash: text("key_hash").notNull().unique(),
  label: text("label"),
  revoked: boolean("revoked").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
