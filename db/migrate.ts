import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { env } from "../config/env.ts";

const pool = new Pool({ connectionString: env.databaseUrl });
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(currentDir, "migrations");

async function main() {
  const db = drizzle(pool);
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder });
  console.log("Migrations complete.");
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
