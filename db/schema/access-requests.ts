import { sql } from "drizzle-orm";
import { integer, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { cinnamonSchema } from "./cinnamon-schema.ts";
import { users } from "./users.ts";

export const accessRequests = cinnamonSchema.table(
  "access_requests",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    googleSub: text("google_sub"),
    name: text("name"),
    picture: text("picture"),
    status: text("status").notNull().default("pending"),
    requestedAt: timestamp("requested_at").defaultNow().notNull(),
    decidedBy: integer("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at"),
    notes: text("notes"),
  },
  (table) => [
    uniqueIndex("access_requests_pending_email_idx")
      .on(table.email)
      .where(sql`${table.status} = 'pending'`),
  ],
);
