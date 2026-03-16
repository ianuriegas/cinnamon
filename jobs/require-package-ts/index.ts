/**
 * TypeScript job that requires an external package (nanoid).
 * Used to test package resolution in the job runner.
 *
 * Usage: bun run jobs/require-package-ts/index.ts
 */

import { nanoid } from "nanoid";

import { isDirectExecution } from "@/src/lib/is-direct-execution.ts";

type RequirePackageTsPayload = {
  count?: number;
};

function parseCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 10) : 3;
}

async function runRequirePackageTsJob(payload: RequirePackageTsPayload = {}) {
  const count = parseCount(payload.count ?? 3);
  const ids: string[] = [];

  for (let i = 0; i < count; i++) {
    ids.push(nanoid());
  }

  console.log(`Generated ${count} nanoid(s):`);
  for (const [i, id] of ids.entries()) {
    console.log(`  ${i + 1}. ${id}`);
  }

  return { ids, count };
}

if (isDirectExecution(import.meta.url)) {
  const count = parseCount(process.argv[2]);
  runRequirePackageTsJob({ count })
    .then((result) => {
      console.log("Done:", JSON.stringify(result));
    })
    .catch((error) => {
      console.error("Job failed:", error);
      process.exit(1);
    });
}
