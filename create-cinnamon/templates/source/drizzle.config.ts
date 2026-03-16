import { defineConfig } from "drizzle-kit";
import { getEnv } from "@/config/env.ts";

export default defineConfig({
  schema: "./db/schema",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: getEnv().databaseUrl,
  },
  strict: true,
  verbose: true,
});
