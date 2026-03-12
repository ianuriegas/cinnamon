import { integer, serial, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { cinnamonSchema } from "./cinnamon-schema.ts";
import { teams } from "./teams.ts";
import { users } from "./users.ts";

export const userTeams = cinnamonSchema.table(
  "user_teams",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("user_teams_user_team_idx").on(table.userId, table.teamId)],
);
