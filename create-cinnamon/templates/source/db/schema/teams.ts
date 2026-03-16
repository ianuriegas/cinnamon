import { serial, text, timestamp } from "drizzle-orm/pg-core";
import { cinnamonSchema } from "./cinnamon-schema.ts";

export const teams = cinnamonSchema.table("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
