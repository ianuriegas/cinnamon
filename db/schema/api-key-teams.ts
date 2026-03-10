import { integer, pgTable, serial, unique } from "drizzle-orm/pg-core";
import { apiKeys } from "./api-keys.ts";
import { teams } from "./teams.ts";

export const apiKeyTeams = pgTable(
  "api_key_teams",
  {
    id: serial("id").primaryKey(),
    apiKeyId: integer("api_key_id")
      .notNull()
      .references(() => apiKeys.id, { onDelete: "cascade" }),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
  },
  (t) => [unique().on(t.apiKeyId, t.teamId)],
);
