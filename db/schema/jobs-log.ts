import { boolean, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const jobsLog = pgTable("jobs_log", {
  id: serial("id").primaryKey(),
  jobId: text("job_id").notNull().unique(),
  queueName: text("queue_name").notNull(),
  jobName: text("job_name").notNull(),
  status: text("status").notNull(),
  payload: jsonb("payload"),
  result: jsonb("result"),
  error: boolean("error").notNull().default(false),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
