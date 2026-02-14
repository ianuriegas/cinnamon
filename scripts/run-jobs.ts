import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { clearScreenDown, cursorTo, emitKeypressEvents, moveCursor } from "node:readline";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptsDir, "..");
const jobsDir = path.join(rootDir, "jobs");

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  hideCursor: "\x1b[?25l",
  showCursor: "\x1b[?25h",
} as const;

type JobEntry = {
  label: string;
  fileName: string;
};

function displayNameFromFile(fileName: string): string {
  return fileName.replace(/\.(ts|js|mjs|cjs)$/i, "");
}

async function listJobs(): Promise<JobEntry[]> {
  const entries = await readdir(jobsDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /\.(ts|js|mjs|cjs)$/i.test(name))
    .sort((a, b) => a.localeCompare(b))
    .map((fileName) => ({
      label: displayNameFromFile(fileName),
      fileName,
    }));
}

function printHelp(jobs: JobEntry[]) {
  console.log(`${ANSI.bold}Usage${ANSI.reset}`);
  console.log("  bun run job [job-name|job-file] [-- <job args>]");
  console.log("");
  console.log(`${ANSI.bold}Available Jobs${ANSI.reset}`);
  for (const job of jobs) {
    console.log(`  - ${ANSI.cyan}${job.label}${ANSI.reset} (${job.fileName})`);
  }
}

function resolveJobFromArg(jobs: JobEntry[], arg: string): JobEntry | null {
  const normalized = arg.trim().toLowerCase();
  if (!normalized) return null;

  return (
    jobs.find((job) => job.fileName.toLowerCase() === normalized) ??
    jobs.find((job) => job.label.toLowerCase() === normalized) ??
    null
  );
}

function clearRenderedLines(lineCount: number) {
  if (lineCount <= 0) return;
  moveCursor(output, 0, -lineCount);
  cursorTo(output, 0);
  clearScreenDown(output);
}

function renderMenu(jobs: JobEntry[], selectedIndex: number): number {
  let renderedLines = 0;
  const width = output.columns && output.columns > 0 ? output.columns : 80;
  const countLines = (line: string) => Math.max(1, Math.ceil(line.length / width));

  const title = `${ANSI.bold}Select a job to run${ANSI.reset}`;
  const hint = `${ANSI.dim}↑/↓ move  Enter run  q cancel${ANSI.reset}`;
  output.write(`${title}\n${hint}\n\n`);
  renderedLines += countLines(title) + countLines(hint) + 1;

  for (const [index, job] of jobs.entries()) {
    const isSelected = index === selectedIndex;
    const marker = isSelected ? `${ANSI.green}>${ANSI.reset}` : " ";
    const label = isSelected ? `${ANSI.bold}${job.label}${ANSI.reset}` : job.label;
    const line = `${marker} ${label} ${ANSI.dim}(${job.fileName})${ANSI.reset}`;
    output.write(`${line}\n`);
    renderedLines += countLines(line);
  }

  return renderedLines;
}

async function chooseJobFromMenu(jobs: JobEntry[]): Promise<JobEntry | null> {
  if (!input.isTTY || !output.isTTY) return null;

  return await new Promise<JobEntry | null>((resolve) => {
    let selectedIndex = 0;
    let renderedLines = 0;
    let finished = false;

    const redraw = () => {
      if (renderedLines > 0) {
        clearRenderedLines(renderedLines);
      }
      renderedLines = renderMenu(jobs, selectedIndex);
    };

    const cleanup = (result: JobEntry | null) => {
      if (finished) return;
      finished = true;

      input.off("keypress", onKeypress);
      if (input.isTTY) input.setRawMode(false);
      input.pause();
      output.write(ANSI.showCursor);

      if (renderedLines > 0) {
        clearRenderedLines(renderedLines);
      }

      resolve(result);
    };

    const onKeypress = (_: string, key: { ctrl?: boolean; name?: string }) => {
      if (key.ctrl && key.name === "c") {
        cleanup(null);
        return;
      }

      if (key.name === "up" || key.name === "k") {
        selectedIndex = (selectedIndex - 1 + jobs.length) % jobs.length;
        redraw();
        return;
      }

      if (key.name === "down" || key.name === "j") {
        selectedIndex = (selectedIndex + 1) % jobs.length;
        redraw();
        return;
      }

      if (key.name === "return") {
        cleanup(jobs[selectedIndex] ?? null);
        return;
      }

      if (key.name === "q" || key.name === "escape") {
        cleanup(null);
      }
    };

    emitKeypressEvents(input);
    input.on("keypress", onKeypress);
    input.setRawMode(true);
    input.resume();
    output.write(ANSI.hideCursor);
    redraw();
  });
}

async function chooseJobFromPrompt(jobs: JobEntry[]): Promise<JobEntry | null> {
  console.log("Available jobs:");
  for (const [index, job] of jobs.entries()) {
    console.log(`  ${index + 1}. ${job.label} (${job.fileName})`);
  }

  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question("Pick a job number: ");
    const selectedIndex = Number(answer.trim());

    if (!Number.isInteger(selectedIndex) || selectedIndex < 1 || selectedIndex > jobs.length) {
      console.error("Invalid selection.");
      return null;
    }

    return jobs[selectedIndex - 1] ?? null;
  } finally {
    rl.close();
  }
}

async function chooseJob(jobs: JobEntry[]): Promise<JobEntry | null> {
  if (input.isTTY && output.isTTY) {
    return chooseJobFromMenu(jobs);
  }

  return chooseJobFromPrompt(jobs);
}

async function runSelectedJob(job: JobEntry, forwardedArgs: string[]) {
  const child = spawn("bun", ["run", `jobs/${job.fileName}`, ...forwardedArgs], {
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

  const [jobArg, ...forwardedArgs] = process.argv.slice(2);

  if (jobArg === "--help" || jobArg === "-h") {
    printHelp(jobs);
    return;
  }

  const selected = jobArg ? resolveJobFromArg(jobs, jobArg) : await chooseJob(jobs);

  if (!selected) {
    if (jobArg) {
      console.error(`Unknown job '${jobArg}'.`);
      printHelp(jobs);
    }
    process.exit(1);
  }

  console.log(`${ANSI.green}Running${ANSI.reset} ${ANSI.bold}${selected.label}${ANSI.reset}`);
  await runSelectedJob(selected, forwardedArgs);
}

main().catch((error) => {
  console.error("Failed to run selected job:", error);
  process.exit(1);
});
