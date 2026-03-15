import { createHash, randomBytes } from "node:crypto";

export function hashKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function generateApiKey(): { plainKey: string; keyHash: string } {
  const plainKey = `cin_${randomBytes(32).toString("hex")}`;
  const keyHash = hashKey(plainKey);
  return { plainKey, keyHash };
}
