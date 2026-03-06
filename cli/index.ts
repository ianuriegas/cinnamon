#!/usr/bin/env bun
import { ApiError, createClient } from "./client.ts";
import { initCommand } from "./commands/init.ts";
import { jobsCommand } from "./commands/jobs.ts";
import { logsCommand } from "./commands/logs.ts";
import { schedulesCommand } from "./commands/schedules.ts";
import { statusCommand } from "./commands/status.ts";
import { triggerCommand } from "./commands/trigger.ts";
import { validateCommand } from "./commands/validate.ts";
import { loadCliConfig } from "./config.ts";
import { bold, dim } from "./format.ts";

const HELP = `
${bold("cinnamon")} — CLI for the Cinnamon job runner

${bold("Usage:")}
  cinnamon <command> [options]

${bold("Commands:")}
  trigger <name> [--data '{...}']   Trigger a job by name
  status  <name> [--limit N]        Show recent runs for a job
  logs    <id>                       Show full output for a run
  jobs                               List registered job definitions
  schedules                          List active cron schedules
  validate [path]                    Validate cinnamon.config.ts locally
  init                               Set up ~/.cinnamon/config.json
  help                               Show this help message

${bold("Global options:")}
  --api-url <url>                    Override API base URL
  --api-key <key>                    Override API key

${bold("Environment variables:")}
  CINNAMON_API_URL                   API base URL
  CINNAMON_API_KEY                   API key

${dim("Config file: ~/.cinnamon/config.json")}
`.trim();

function parseGlobalFlags(argv: string[]): {
  command: string | undefined;
  args: string[];
  apiUrl?: string;
  apiKey?: string;
} {
  const filtered: string[] = [];
  let apiUrl: string | undefined;
  let apiKey: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--api-url" && argv[i + 1]) {
      apiUrl = argv[++i];
    } else if (argv[i] === "--api-key" && argv[i + 1]) {
      apiKey = argv[++i];
    } else {
      filtered.push(argv[i]);
    }
  }

  return {
    command: filtered[0],
    args: filtered.slice(1),
    apiUrl,
    apiKey,
  };
}

const COMMANDS_NEEDING_API = new Set(["trigger", "status", "logs", "jobs", "schedules"]);

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const { command, args, apiUrl, apiKey } = parseGlobalFlags(rawArgs);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(HELP);
    return;
  }

  if (command === "init") {
    await initCommand();
    return;
  }

  if (command === "validate") {
    await validateCommand(args);
    return;
  }

  if (!COMMANDS_NEEDING_API.has(command)) {
    console.error(`Unknown command: ${command}\n\nRun ${bold("cinnamon help")} for usage.`);
    process.exit(1);
  }

  const config = loadCliConfig({ apiUrl, apiKey });
  const client = createClient(config);

  switch (command) {
    case "trigger":
      await triggerCommand(client, args);
      break;
    case "status":
      await statusCommand(client, args);
      break;
    case "logs":
      await logsCommand(client, args);
      break;
    case "jobs":
      await jobsCommand(client);
      break;
    case "schedules":
      await schedulesCommand(client);
      break;
  }
}

main().catch((err) => {
  if (err instanceof ApiError) {
    console.error(`API error (${err.status}): ${err.message}`);
  } else {
    console.error((err as Error).message);
  }
  process.exit(1);
});
