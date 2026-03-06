import type { Client } from "../client.ts";
import { bold, formatDuration, formatTimestamp, statusColor, table } from "../format.ts";

interface JobRun {
  id: number;
  jobName: string;
  status: string;
  createdAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

interface ListResponse {
  data: JobRun[];
  pagination: { total: number };
}

export async function statusCommand(client: Client, args: string[]): Promise<void> {
  const name = args[0];
  if (!name) {
    console.error("Usage: cinnamon status <job-name> [--limit N]");
    process.exit(1);
  }

  let limit = 10;
  const limitIdx = args.indexOf("--limit");
  if (limitIdx !== -1) {
    const val = Number(args[limitIdx + 1]);
    if (Number.isNaN(val) || val <= 0) {
      console.error("--limit must be a positive number");
      process.exit(1);
    }
    limit = val;
  }

  const params = new URLSearchParams({ name, limit: String(limit) });
  const res = await client.get<ListResponse>(`/v1/jobs?${params}`);

  if (res.data.length === 0) {
    console.log(`No runs found for ${bold(name)}`);
    return;
  }

  console.log(`${bold("Recent runs for")} ${bold(name)} (${res.pagination.total} total)\n`);

  const headers = ["ID", "Status", "Duration", "Started"];
  const rows = res.data.map((r) => [
    String(r.id),
    statusColor(r.status),
    formatDuration(r.startedAt, r.finishedAt),
    formatTimestamp(r.createdAt),
  ]);

  console.log(table(headers, rows));
}
