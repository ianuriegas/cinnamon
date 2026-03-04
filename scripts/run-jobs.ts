import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { intro, isCancel, log, outro, select } from "@clack/prompts";
import { fileExists } from "./_utils.ts";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptsDir, "..");
const jobsDir = path.join(rootDir, "jobs");

type JobEntry = {
  label: string;
  /** Relative path from jobs/ to the entrypoint (e.g. "cinnamon/index.ts" or "spotify/recently-played/index.ts") */
  entrypoint: string;
};

const DRY_RUN_SUPPORTED_JOBS = new Set(["spotify/recently-played", "spotify/top-tracks"]);

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

async function listJobs(): Promise<JobEntry[]> {
  const entries = await readdir(jobsDir, { withFileTypes: true });
  const jobs: JobEntry[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;

    const indexPath = path.join(jobsDir, entry.name, "index.ts");
    if (await fileExists(indexPath)) {
      jobs.push({
        label: entry.name,
        entrypoint: `${entry.name}/index.ts`,
      });
      continue;
    }

    const subEntries = await readdir(path.join(jobsDir, entry.name), { withFileTypes: true });
    for (const sub of subEntries) {
      if (!sub.isDirectory() || sub.name.startsWith("_")) continue;

      const subIndexPath = path.join(jobsDir, entry.name, sub.name, "index.ts");
      if (await fileExists(subIndexPath)) {
        jobs.push({
          label: `${entry.name}/${sub.name}`,
          entrypoint: `${entry.name}/${sub.name}/index.ts`,
        });
      }
    }
  }

  return jobs.sort((a, b) => a.label.localeCompare(b.label));
}

function resolveJobFromArg(jobs: JobEntry[], arg: string): JobEntry | null {
  const normalized = arg.trim().toLowerCase();
  if (!normalized) return null;

  return (
    jobs.find((job) => job.entrypoint.toLowerCase() === normalized) ??
    jobs.find((job) => job.label.toLowerCase() === normalized) ??
    jobs.find((job) => {
      const lastSegment = job.label.split("/").pop();
      return lastSegment?.toLowerCase() === normalized;
    }) ??
    null
  );
}

function withDryRunArgs(job: JobEntry, forwardedArgs: string[], dryRun: boolean): string[] {
  if (!dryRun) {
    return forwardedArgs;
  }

  if (!DRY_RUN_SUPPORTED_JOBS.has(job.label)) {
    log.warn(`'${job.label}' does not define a dry-run mode. Running normally.`);
    return forwardedArgs;
  }

  if (forwardedArgs.some((arg) => isDryRunFlag(arg))) {
    return forwardedArgs;
  }

  return [...forwardedArgs, "--dry"];
}

async function runSelectedJob(job: JobEntry, forwardedArgs: string[], dryRun: boolean) {
  const effectiveArgs = withDryRunArgs(job, forwardedArgs, dryRun);
  const child = spawn("bun", ["run", `jobs/${job.entrypoint}`, ...effectiveArgs], {
    cwd: rootDir,
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
  const jobs = await listJobs();

  if (jobs.length === 0) {
    console.error("No jobs found in jobs/.");
    process.exit(1);
  }

  const { dryRun, jobArg, forwardedArgs } = parseCliArgs(process.argv.slice(2));

  if (jobArg === "--help" || jobArg === "-h") {
    console.log("Usage: bun run job [--dry] [job-name|job-file] [-- <job args>]");
    console.log("       bun run job:dry\n");
    console.log("Available jobs:");
    for (const job of jobs) {
      console.log(`  - ${job.label} (${job.entrypoint})`);
    }
    return;
  }

  let selected: JobEntry | null = null;

  if (jobArg) {
    selected = resolveJobFromArg(jobs, jobArg);
    if (!selected) {
      console.error(`Unknown job '${jobArg}'.`);
      process.exit(1);
    }
  } else {
    intro(dryRun ? "Select a job to run (DRY RUN)" : "Select a job to run");

    const result = await select({
      message: "Pick a job",
      options: jobs.map((job) => ({
        value: job,
        label: job.label,
      })),
    });

    if (isCancel(result)) {
      outro("Cancelled.");
      process.exit(0);
    }

    selected = result;
  }

  log.info(`Running ${selected.label}${dryRun ? " (dry run)" : ""}`);
  await runSelectedJob(selected, forwardedArgs, dryRun);
}

main().catch((error) => {
  console.error("Failed to run selected job:", error);
  process.exit(1);
});
