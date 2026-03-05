import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";

import { db, pool } from "@/db/index.ts";
import { apiKeys } from "@/db/schema/api-keys.ts";
import { teams } from "@/db/schema/teams.ts";

const DEFAULT_TEAM_NAME = "Default Team";

function hashKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

async function main() {
  const existing = await db.select().from(teams).where(eq(teams.name, DEFAULT_TEAM_NAME)).limit(1);

  let teamId: number;

  if (existing.length > 0) {
    teamId = existing[0].id;
    console.log(`Team "${DEFAULT_TEAM_NAME}" already exists (id=${teamId}).`);
  } else {
    const [inserted] = await db
      .insert(teams)
      .values({ name: DEFAULT_TEAM_NAME })
      .returning({ id: teams.id });
    teamId = inserted.id;
    console.log(`Created team "${DEFAULT_TEAM_NAME}" (id=${teamId}).`);
  }

  const plainKey = `cin_${randomBytes(32).toString("hex")}`;
  const keyHash = hashKey(plainKey);

  await db.insert(apiKeys).values({
    teamId,
    keyHash,
    label: "default-dev",
  });

  console.log("\n--- Save this key, it will not be shown again ---");
  console.log(`API Key: ${plainKey}`);
  console.log("--------------------------------------------------\n");

  await pool.end();
}

main().catch(async (error) => {
  console.error("Seed failed:", error);
  await pool.end();
  process.exit(1);
});
