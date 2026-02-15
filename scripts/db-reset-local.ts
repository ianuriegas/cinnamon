import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.ts";

const pool = new Pool({ connectionString: env.databaseUrl });
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(currentDir, "..", "db", "migrations");

async function main() {
  console.log("Resetting local database schema...");
  // Drizzle stores migration state in the `drizzle` schema. Drop it so migrations re-run from scratch.
  await pool.query('DROP SCHEMA IF EXISTS "drizzle" CASCADE;');
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE;");
  await pool.query("CREATE SCHEMA public;");

  const db = drizzle(pool);
  console.log("Applying migrations...");
  await migrate(db, { migrationsFolder });

  console.log("Local database reset complete.");
  await pool.end();
}

main().catch(async (error) => {
  console.error("Local DB reset failed:", error);
  await pool.end();
  process.exit(1);
});
