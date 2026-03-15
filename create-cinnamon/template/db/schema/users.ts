import { boolean, serial, text, timestamp } from "drizzle-orm/pg-core";
import { cinnamonSchema } from "./cinnamon-schema.ts";

export const users = cinnamonSchema.table("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  picture: text("picture"),
  googleSub: text("google_sub").notNull().unique(),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  disabled: boolean("disabled").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
});
