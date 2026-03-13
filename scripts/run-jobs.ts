import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { intro, isCancel, log, outro, select } from "@clack/prompts";
import type { JobDefinition } from "@/config/define-config.ts";
import { interpolateEnv } from "@/config/dynamic-registry.ts";
import { loadConfig } from "@/config/load-config.ts";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptsDir, "..");

function isDryRunFlag(arg: string): boolean {
  return arg === "--dry" || arg === "--dry-run" || arg === "-d";
}

function parseCliArgs(rawArgs: string[]) {
  let dryRun = false;
  const cleanedArgs: string[] = [];

  for (const arg of rawArgs) {
    if (isDryRunFlag(arg)) {
      dryRun = true;
      continue;
    }
    cleanedArgs.push(arg);
  }

  const [jobArg, ...forwardedArgs] = cleanedArgs;
  return { dryRun, jobArg, forwardedArgs };
}

function buildSpawnArgs(def: JobDefinition, forwardedArgs: string[], dryRun: boolean): string[] {
  const baseArgs = [...(def.script ? [def.script] : []), ...(def.args ?? [])];
  const dryRunArgs = dryRun && !forwardedArgs.some((a) => isDryRunFlag(a)) ? ["--dry-run"] : [];
  return [...baseArgs, ...forwardedArgs, ...dryRunArgs];
}

async function runJob(def: JobDefinition, forwardedArgs: string[], dryRun: boolean) {
  const args = buildSpawnArgs(def, forwardedArgs, dryRun);
  const env = def.env ? { ...process.env, ...interpolateEnv(def.env) } : undefined;
  const cwd = def.cwd ? path.resolve(rootDir, def.cwd) : rootDir;

  const child = spawn(def.command, args, {
    cwd,
    env,
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.error(`Job runner terminated by signal: ${signal}`);
      process.exit(1);
    }
    process.exit(code ?? 0);
  });
}

async function main() {
  const config = await loadConfig();
  const jobNames = Object.keys(config.jobs).sort();

  if (jobNames.length === 0) {
    console.error("No jobs defined in cinnamon.config.ts.");
    process.exit(1);
  }

  const { dryRun, jobArg, forwardedArgs } = parseCliArgs(process.argv.slice(2));

  if (jobArg === "--help" || jobArg === "-h") {
    console.log("Usage: bun run job [--dry] [job-name] [-- <job args>]");
    console.log("       bun run job:dry\n");
    console.log("Available jobs:");
    for (const name of jobNames) {
      const def = config.jobs[name];
      const desc = def.description ? ` - ${def.description}` : "";
      console.log(`  - ${name}${desc}`);
    }
    return;
  }

  let jobName: string;

  if (jobArg) {
    if (!(jobArg in config.jobs)) {
      console.error(`Unknown job '${jobArg}'. Available: ${jobNames.join(", ")}`);
      process.exit(1);
    }
    jobName = jobArg;
  } else {
    intro(dryRun ? "Select a job to run (DRY RUN)" : "Select a job to run");

    const result = await select({
      message: "Pick a job",
      options: jobNames.map((name) => ({
        value: name,
        label: name,
        hint: config.jobs[name].description,
      })),
    });

    if (isCancel(result)) {
      outro("Cancelled.");
      process.exit(0);
    }

    jobName = result as string;
  }

  const def = config.jobs[jobName];
  log.info(`Running ${jobName}${dryRun ? " (dry run)" : ""}`);
  await runJob(def, forwardedArgs, dryRun);
}

main().catch((error) => {
  console.error("Failed to run selected job:", error);
  process.exit(1);
});
