import { and, eq } from "drizzle-orm";

import { db } from "@/db/index.ts";
import { apiKeys } from "@/db/schema/api-keys.ts";
import { hashKey } from "@/src/lib/api-key-utils.ts";

export async function verifyApiKey(plainKey: string): Promise<{ teamId: number } | null> {
  const keyHash = hashKey(plainKey);

  const rows = await db
    .select({ teamId: apiKeys.teamId, id: apiKeys.id })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.revoked, false)))
    .limit(1);

  if (rows.length === 0) return null;

  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, rows[0].id))
    .execute()
    .catch(() => {});

  return { teamId: rows[0].teamId };
}
