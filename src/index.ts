import path from "node:path";
import { fileURLToPath } from "node:url";
import { parsePayloadArg } from "./payload.ts";
import { jobsQueue } from "./queue.ts";

async function main() {
  const [jobName, payloadArg] = process.argv.slice(2);

  if (!jobName) {
    console.error("Usage: bun run trigger <job-name> [payload]");
    console.error("Example: bun run trigger cinnamon 10");
    await jobsQueue.close();
    process.exit(1);
  }

  const payload = parsePayloadArg(payloadArg);
  const job = await jobsQueue.add(jobName, payload);
  console.log(`Queued job ${job.id} (${job.name}).`);
  console.log("(Make sure the worker is running to process it)");
  await jobsQueue.close();
}

const isDirectExecution =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch(async (error) => {
    console.error("Failed to queue job:", error);
    await jobsQueue.close();
    process.exit(1);
  });
}
