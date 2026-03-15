import { boolean, integer, serial, text, timestamp } from "drizzle-orm/pg-core";
import { cinnamonSchema } from "./cinnamon-schema.ts";
import { teams } from "./teams.ts";

export const apiKeys = cinnamonSchema.table("api_keys", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id),
  keyHash: text("key_hash").notNull().unique(),
  label: text("label"),
  revoked: boolean("revoked").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
});
