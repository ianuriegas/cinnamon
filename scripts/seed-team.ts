import { eq } from "drizzle-orm";

import { db, pool } from "@/db/index.ts";
import { apiKeys } from "@/db/schema/api-keys.ts";
import { teams } from "@/db/schema/teams.ts";
import { generateApiKey } from "@/src/lib/api-key-utils.ts";

const DEFAULT_TEAM_NAME = "Default Team";

async function seedTeam(teamName: string, label?: string) {
  const existing = await db.select().from(teams).where(eq(teams.name, teamName)).limit(1);

  let teamId: number;

  if (existing.length > 0) {
    teamId = existing[0].id;
    console.log(`Team "${teamName}" already exists (id=${teamId}).`);
  } else {
    const [inserted] = await db
      .insert(teams)
      .values({ name: teamName })
      .returning({ id: teams.id });
    teamId = inserted.id;
    console.log(`Created team "${teamName}" (id=${teamId}).`);
  }

  const { plainKey, keyHash } = generateApiKey();
  const keyLabel = label ?? teamName.toLowerCase().replace(/\s+/g, "-");

  await db.insert(apiKeys).values({ teamId, keyHash, label: keyLabel });

  console.log("\n--- Save this key, it will not be shown again ---");
  console.log(`API Key: ${plainKey}`);
  console.log(`Team:    ${teamName} (id=${teamId})`);
  console.log(`Label:   ${keyLabel}`);
  console.log("--------------------------------------------------\n");
}

async function main() {
  const teamName = process.argv[2] || DEFAULT_TEAM_NAME;
  const label = process.argv[3];

  await seedTeam(teamName, label);
  await pool.end();
}

main().catch(async (error) => {
  console.error("Seed failed:", error);
  await pool.end();
  process.exit(1);
});
