import type { Client } from "../client.ts";
import { formatTimestamp, table } from "../format.ts";

interface Schedule {
  name: string;
  pattern: string;
  next: string | null;
}

interface SchedulesResponse {
  data: Schedule[];
}

export async function schedulesCommand(client: Client): Promise<void> {
  const res = await client.get<SchedulesResponse>("/v1/jobs/schedules");

  if (res.data.length === 0) {
    console.log("No active schedules.");
    return;
  }

  const headers = ["Name", "Pattern", "Next Run"];
  const rows = res.data.map((s) => [s.name, s.pattern, formatTimestamp(s.next)]);

  console.log(table(headers, rows));
}
