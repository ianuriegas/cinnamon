import { boolean, integer, jsonb, serial, text, timestamp } from "drizzle-orm/pg-core";
import { cinnamonSchema } from "./cinnamon-schema.ts";
import { teams } from "./teams.ts";

export const jobsLog = cinnamonSchema.table("jobs_log", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id),
  jobId: text("job_id").notNull().unique(),
  queueName: text("queue_name").notNull(),
  jobName: text("job_name").notNull(),
  status: text("status").notNull(),
  payload: jsonb("payload"),
  result: jsonb("result"),
  logs: text("logs"),
  error: boolean("error").notNull().default(false),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
