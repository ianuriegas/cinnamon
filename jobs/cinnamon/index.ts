/**
 * Cinnamon countdown job.
 *
 * Usage: bun run jobs/cinnamon/index.ts [start]
 */

import { isDirectExecution } from "../_shared/is-direct-execution.ts";

const DEFAULT_START = 10;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const spinnerFrames = ["|", "/", "-", "\\"] as const;

export type CinnamonJobPayload = {
  start?: number;
};

export function parseStart(value: unknown): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_START;
}

async function runCountdown(start: number) {
  for (let i = start; i > 0; i--) {
    console.log(i);
    await sleep(1000);
  }
}

async function spinCinnamon() {
  if (!process.stdout.isTTY) {
    console.log("Cinnamon!");
    return;
  }

  for (let i = 0; i < 12; i++) {
    const frame = spinnerFrames[i % spinnerFrames.length];
    process.stdout.write(`\r${frame} Cinnamon! ${frame}`);
    await sleep(90);
  }

  process.stdout.write("\rCinnamon!        \n");
}

export async function runCinnamonJob(payload: CinnamonJobPayload = {}) {
  const start = parseStart(payload.start);
  console.log(`Starting countdown from ${start}...`);
  await runCountdown(start);
  await spinCinnamon();
}

if (isDirectExecution(import.meta.url)) {
  const start = parseStart(process.argv[2]);
  runCinnamonJob({ start }).catch((error) => {
    console.error("Countdown job failed:", error);
    process.exit(1);
  });
}
