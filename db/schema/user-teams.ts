import { integer, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";
import { teams } from "./teams.ts";
import { users } from "./users.ts";

export const userTeams = pgTable(
  "user_teams",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // "admin" | "member" | "viewer"
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.userId, t.teamId)],
);
