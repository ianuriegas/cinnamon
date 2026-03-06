import type { Client } from "../client.ts";
import { dim, table } from "../format.ts";

interface JobDef {
  name: string;
  command: string;
  script?: string;
  schedule?: string;
  timeout?: string;
  retries?: number;
  description?: string;
}

interface DefsResponse {
  data: JobDef[];
}

export async function jobsCommand(client: Client): Promise<void> {
  const res = await client.get<DefsResponse>("/v1/jobs/definitions");

  if (res.data.length === 0) {
    console.log("No job definitions registered.");
    return;
  }

  const headers = ["Name", "Command", "Schedule", "Timeout", "Description"];
  const rows = res.data.map((d) => [
    d.name,
    d.script ? `${d.command} ${d.script}` : d.command,
    d.schedule ?? dim("—"),
    d.timeout ?? dim("—"),
    d.description ?? dim("—"),
  ]);

  console.log(table(headers, rows));
}
