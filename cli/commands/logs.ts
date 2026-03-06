import type { Client } from "../client.ts";
import { bold, cyan, dim, statusColor } from "../format.ts";

interface JobResult {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  parsed?: unknown;
}

interface JobDetail {
  data: {
    id: number;
    jobName: string;
    status: string;
    payload: unknown;
    result: JobResult | null;
    createdAt: string | null;
    startedAt: string | null;
    finishedAt: string | null;
  };
}

export async function logsCommand(client: Client, args: string[]): Promise<void> {
  const idArg = args[0];
  if (!idArg) {
    console.error("Usage: cinnamon logs <job-id>");
    process.exit(1);
  }

  const res = await client.get<JobDetail>(`/v1/jobs/${encodeURIComponent(idArg)}`);
  const job = res.data;
  const result = job.result;

  console.log(`${bold("Job")} ${cyan(job.jobName)} ${dim(`#${job.id}`)}`);
  console.log(`${bold("Status:")} ${statusColor(job.status)}`);
  if (job.createdAt) console.log(`${bold("Created:")} ${job.createdAt}`);
  if (job.startedAt) console.log(`${bold("Started:")} ${job.startedAt}`);
  if (job.finishedAt) console.log(`${bold("Finished:")} ${job.finishedAt}`);

  if (!result) {
    console.log(dim("\nNo output yet."));
    return;
  }

  if (result.exitCode !== undefined) {
    console.log(`${bold("Exit code:")} ${result.exitCode}`);
  }

  if (result.stdout) {
    console.log(`\n${bold("── stdout ──")}\n${result.stdout}`);
  }

  if (result.stderr) {
    console.log(`\n${bold("── stderr ──")}\n${result.stderr}`);
  }

  if (result.parsed !== undefined && result.parsed !== null) {
    console.log(`\n${bold("── parsed output ──")}\n${JSON.stringify(result.parsed, null, 2)}`);
  }
}
