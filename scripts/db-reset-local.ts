import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { pool } from "@/db/connection.ts";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(currentDir, "..", "db", "migrations");

async function main() {
  console.log("Resetting local database schema...");
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
