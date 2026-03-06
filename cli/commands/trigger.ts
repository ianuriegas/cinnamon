import type { Client } from "../client.ts";
import { bold, cyan } from "../format.ts";

interface TriggerResponse {
  jobId: string;
  jobName: string;
}

export async function triggerCommand(client: Client, args: string[]): Promise<void> {
  const name = args[0];
  if (!name) {
    console.error("Usage: cinnamon trigger <job-name> [--data '{...}']");
    process.exit(1);
  }

  let data: Record<string, unknown> = {};
  const dataIdx = args.indexOf("--data");
  if (dataIdx !== -1) {
    const raw = args[dataIdx + 1];
    if (!raw) {
      console.error("--data requires a JSON string argument");
      process.exit(1);
    }
    try {
      data = JSON.parse(raw);
    } catch {
      console.error(`Invalid JSON for --data: ${raw}`);
      process.exit(1);
    }
  }

  const res = await client.post<TriggerResponse>(`/v1/jobs/${encodeURIComponent(name)}/trigger`, {
    data,
  });

  console.log(`${bold("Triggered")} ${cyan(res.jobName)}  job_id=${res.jobId}`);
}
