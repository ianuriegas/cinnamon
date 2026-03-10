import { getJobOptions } from "@/config/dynamic-registry.ts";
import { loadConfig } from "@/config/load-config.ts";
import { isDirectExecution } from "@/jobs/_shared/is-direct-execution.ts";
import { parsePayloadArg } from "./payload.ts";
import { jobsQueue } from "./queue.ts";

async function main() {
  const [jobName, payloadArg] = process.argv.slice(2);

  if (!jobName) {
    console.error("Usage: bun run trigger <job-name> [payload]");
    console.error("Example: bun run trigger cinnamon 10");
    console.error('Example: bun run trigger hello-world \'{"key":"value"}\'');
    await jobsQueue.close();
    process.exit(1);
  }

  const payload = parsePayloadArg(payloadArg);
  const config = await loadConfig();
  const opts = getJobOptions(jobName, config);
  const job = await jobsQueue.add(jobName, payload, opts);
  console.log(`Queued job ${job.id} (${job.name}).`);
  console.log("(Make sure the worker is running to process it)");
  await jobsQueue.close();
}

if (isDirectExecution(import.meta.url)) {
  main().catch(async (error) => {
    console.error("Failed to queue job:", error);
    await jobsQueue.close();
    process.exit(1);
  });
}
