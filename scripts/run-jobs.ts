import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isCancel } from "@clack/core";
import { intro, log, outro } from "@clack/prompts";
import { type TreeNode, treeSelect } from "./_tree-select.ts";
import { fileExists } from "./_utils.ts";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptsDir, "..");
const jobsDir = path.join(rootDir, "jobs");

type JobEntry = {
  label: string;
  /** Relative path from jobs/ to the entrypoint (e.g. "cinnamon/index.ts") */
  entrypoint: string;
};

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

async function listJobs(dir = jobsDir, prefix = ""): Promise<JobEntry[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const jobs: JobEntry[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;

    const entryDir = path.join(dir, entry.name);
    const label = prefix ? `${prefix}/${entry.name}` : entry.name;
    const indexPath = path.join(entryDir, "index.ts");

    if (await fileExists(indexPath)) {
      jobs.push({ label, entrypoint: `${label}/index.ts` });
    } else {
      jobs.push(...(await listJobs(entryDir, label)));
    }
  }

  return jobs.sort((a, b) => a.label.localeCompare(b.label));
}

function buildJobTree(jobs: JobEntry[]): TreeNode<JobEntry>[] {
  const root: TreeNode<JobEntry>[] = [];

  for (const job of jobs) {
    const segments = job.label.split("/");
    let siblings = root;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const isLeaf = i === segments.length - 1;
      let existing = siblings.find((n) => n.label === segment);

      if (!existing) {
        existing = isLeaf ? { label: segment, value: job } : { label: segment, children: [] };
        siblings.push(existing);
      }

      if (!isLeaf) {
        existing.children ??= [];
        siblings = existing.children;
      }
    }
  }

  return root;
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

async function runSelectedJob(job: JobEntry, forwardedArgs: string[], dryRun: boolean) {
  const effectiveArgs =
    dryRun && !forwardedArgs.some((a) => isDryRunFlag(a))
      ? [...forwardedArgs, "--dry-run"]
      : forwardedArgs;
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

    const tree = buildJobTree(jobs);
    const result = await treeSelect<JobEntry>({
      message: "Pick a job",
      tree,
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
