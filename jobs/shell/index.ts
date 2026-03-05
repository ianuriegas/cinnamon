/**
 * Shell job — runs an external command as a subprocess and captures output.
 *
 * Usage: bun run jobs/shell/index.ts <command> [args...]
 * Example: bun run jobs/shell/index.ts python3 ./jobs/shell/scripts/hello.py
 */

import { spawn } from "node:child_process";
import { isDirectExecution } from "../_shared/is-direct-execution.ts";

const DEFAULT_TIMEOUT_MS = 30_000;

export interface ShellJobPayload {
  command: string;
  args?: string[];
  timeoutMs?: number;
}

export interface ShellJobResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function validatePayload(payload: Record<string, unknown>): Required<ShellJobPayload> {
  const { command, args, timeoutMs } = payload;
  if (typeof command !== "string" || command.trim() === "") {
    throw new Error("Shell job requires a non-empty 'command' string in the payload");
  }
  return {
    command,
    args: Array.isArray(args) ? args.map(String) : [],
    timeoutMs: typeof timeoutMs === "number" && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
  };
}

export async function runShellJob(payload: Record<string, unknown>): Promise<ShellJobResult> {
  const { command, args, timeoutMs } = validatePayload(payload);

  console.log(`[shell] Running: ${command} ${args.join(" ")}`);

  return new Promise<ShellJobResult>((resolve, reject) => {
    const proc = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    let killed = false;

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      killed = true;
      proc.kill("SIGKILL");
    }, timeoutMs);

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      const exitCode = code ?? 1;
      const result: ShellJobResult = { stdout, stderr, exitCode };

      if (killed) {
        reject(Object.assign(new Error(`Process timed out after ${timeoutMs}ms`), { result }));
        return;
      }

      if (exitCode !== 0) {
        const msg = stderr.trim() || `Process exited with code ${exitCode}`;
        reject(Object.assign(new Error(msg), { result }));
        return;
      }

      if (stdout) console.log(`[shell] stdout: ${stdout.trimEnd()}`);
      if (stderr) console.log(`[shell] stderr: ${stderr.trimEnd()}`);
      console.log(`[shell] Exit code: ${exitCode}`);
      resolve(result);
    });
  });
}

if (isDirectExecution(import.meta.url)) {
  const [command, ...args] = process.argv.slice(2);
  if (!command) {
    console.error("Usage: bun run jobs/shell/index.ts <command> [args...]");
    process.exit(1);
  }
  runShellJob({ command, args }).catch((error) => {
    console.error("Shell job failed:", error.message);
    process.exit(1);
  });
}
