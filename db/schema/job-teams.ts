import { integer, pgTable, serial, text, unique } from "drizzle-orm/pg-core";
import { teams } from "./teams.ts";

export const jobTeams = pgTable(
  "job_teams",
  {
    id: serial("id").primaryKey(),
    jobName: text("job_name").notNull(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
  },
  (t) => [unique().on(t.jobName, t.teamId)],
);
