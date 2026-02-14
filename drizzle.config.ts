import { defineConfig } from "drizzle-kit";
import { env } from "./config/env.ts";

export default defineConfig({
  schema: "./db/schema",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: env.databaseUrl,
  },
  strict: true,
  verbose: true,
});
