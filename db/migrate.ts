import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { pool } from "./connection.ts";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const coreMigrationsFolder = path.resolve(currentDir, "migrations");
const customMigrationsFolder = path.resolve(currentDir, "custom-migrations");

async function main() {
  const db = drizzle(pool);

  console.log("Running core migrations...");
  await migrate(db, { migrationsFolder: coreMigrationsFolder });
  console.log("Core migrations complete.");

  // Docker-mode users can volume-mount their own migrations into
  // /app/db/custom-migrations. These are tracked in a separate table
  // so they never collide with core migrations on image upgrades.
  if (
    fs.existsSync(customMigrationsFolder) &&
    fs.existsSync(path.join(customMigrationsFolder, "meta", "_journal.json"))
  ) {
    console.log("Running custom migrations...");
    await migrate(db, {
      migrationsFolder: customMigrationsFolder,
      migrationsTable: "__drizzle_migrations_custom",
      migrationsSchema: "public",
    });
    console.log("Custom migrations complete.");
  }

  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
