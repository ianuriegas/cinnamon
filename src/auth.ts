import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/index.ts";
import { apiKeys } from "@/db/schema/api-keys.ts";

function hashKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export async function verifyApiKey(plainKey: string): Promise<{ teamId: number } | null> {
  const keyHash = hashKey(plainKey);

  const rows = await db
    .select({ teamId: apiKeys.teamId })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.revoked, false)))
    .limit(1);

  if (rows.length === 0) return null;

  return { teamId: rows[0].teamId };
}
