import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/index.ts";
import { apiKeyTeams } from "@/db/schema/api-key-teams.ts";
import { apiKeys } from "@/db/schema/api-keys.ts";

function hashKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export async function verifyApiKey(plainKey: string): Promise<{ teamIds: number[] } | null> {
  const keyHash = hashKey(plainKey);

  const keyRows = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.revoked, false)))
    .limit(1);

  if (keyRows.length === 0) return null;

  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.keyHash, keyHash));

  const teamRows = await db
    .select({ teamId: apiKeyTeams.teamId })
    .from(apiKeyTeams)
    .where(eq(apiKeyTeams.apiKeyId, keyRows[0].id));

  return { teamIds: teamRows.map((r) => r.teamId) };
}
