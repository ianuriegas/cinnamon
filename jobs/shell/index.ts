/**
 * Shell job — runs an external command as a subprocess and captures output.
 *
 * Usage: bun run jobs/shell/index.ts <command> [args...]
 * Example: bun run jobs/shell/index.ts python3 ./jobs/shell/scripts/hello.py
 */

import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { UnrecoverableError } from "bullmq";
import { isDirectExecution } from "../_shared/is-direct-execution.ts";

const DEFAULT_TIMEOUT_MS = 30_000;
const LOG_PREVIEW_LIMIT = 200;
const SIGKILL_GRACE_MS = 3_000;

function truncate(text: string, limit = LOG_PREVIEW_LIMIT): string {
  const trimmed = text.trimEnd();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit)}... (truncated, ${trimmed.length} bytes total)`;
}

export interface ShellJobPayload {
  command: string;
  args?: string[];
  timeoutMs?: number;
  parseJsonOutput?: boolean;
  env?: Record<string, string>;
  cwd?: string;
}

export interface ShellJobResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  parsed?: Record<string, unknown> | null;
}

export interface ShellJobOptions {
  signal?: AbortSignal;
  onChunk?: (stream: "stdout" | "stderr", data: string) => void;
  /** Called when the child process is spawned, for zombie cleanup (register/kill on shutdown). */
  onProcSpawn?: (proc: ChildProcess) => void;
}

function validatePayload(payload: Record<string, unknown>): Required<ShellJobPayload> {
  const { command, args, timeoutMs, parseJsonOutput, env, cwd } = payload;
  if (typeof command !== "string" || command.trim() === "") {
    throw new Error("Shell job requires a non-empty 'command' string in the payload");
  }
  return {
    command,
    args: Array.isArray(args) ? args.map(String) : [],
    timeoutMs: typeof timeoutMs === "number" && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
    parseJsonOutput: parseJsonOutput === true,
    env:
      env && typeof env === "object" && !Array.isArray(env)
        ? (env as Record<string, string>)
        : (undefined as unknown as Record<string, string>),
    cwd: typeof cwd === "string" ? cwd : (undefined as unknown as string),
  };
}

/**
 * Scans stdout lines in reverse for the last valid JSON object.
 * Allows scripts to emit logs before their final structured result.
 */
function extractJson(stdout: string): Record<string, unknown> | null {
  const lines = stdout.trimEnd().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith("{")) continue;
    try {
      const obj = JSON.parse(line);
      if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj;
    } catch {
      // not valid JSON, try previous line
    }
  }
  return null;
}

export async function runShellJob(
  payload: Record<string, unknown>,
  options?: ShellJobOptions,
): Promise<ShellJobResult> {
  const { command, args, timeoutMs, parseJsonOutput, env, cwd } = validatePayload(payload);
  const { signal, onChunk, onProcSpawn } = options ?? {};

  if (signal?.aborted) {
    throw Object.assign(new UnrecoverableError("Job cancelled"), {
      result: { stdout: "", stderr: "", exitCode: 1 } satisfies ShellJobResult,
    });
  }

  console.log(`[shell] Running: ${command} ${args.join(" ")}`);

  return new Promise<ShellJobResult>((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: env ? { ...process.env, ...env } : undefined,
      cwd: cwd || undefined,
    });

    onProcSpawn?.(proc);

    let stdout = "";
    let stderr = "";
    let killed = false;
    let cancelled = false;

    proc.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      onChunk?.("stdout", text);
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      onChunk?.("stderr", text);
    });

    const timer = setTimeout(() => {
      killed = true;
      proc.kill("SIGKILL");
    }, timeoutMs);

    let graceTimer: ReturnType<typeof setTimeout> | undefined;

    function handleAbort() {
      if (killed || cancelled) return;
      cancelled = true;
      proc.kill("SIGTERM");
      graceTimer = setTimeout(() => {
        if (!proc.killed) proc.kill("SIGKILL");
      }, SIGKILL_GRACE_MS);
    }

    signal?.addEventListener("abort", handleAbort, { once: true });

    proc.on("error", (err) => {
      clearTimeout(timer);
      clearTimeout(graceTimer);
      signal?.removeEventListener("abort", handleAbort);
      reject(err);
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      clearTimeout(graceTimer);
      signal?.removeEventListener("abort", handleAbort);
      const exitCode = code ?? 1;
      const result: ShellJobResult = { stdout, stderr, exitCode };

      if (cancelled) {
        reject(Object.assign(new UnrecoverableError("Job cancelled"), { result }));
        return;
      }

      if (killed) {
        reject(Object.assign(new Error(`Process timed out after ${timeoutMs}ms`), { result }));
        return;
      }

      if (exitCode !== 0) {
        const msg = stderr.trim() || `Process exited with code ${exitCode}`;
        reject(Object.assign(new Error(msg), { result }));
        return;
      }

      if (parseJsonOutput) {
        result.parsed = extractJson(stdout);
        if (result.parsed) {
          console.log(
            `[shell] JSON result parsed (${Object.keys(result.parsed).length} keys, ${stdout.length} bytes)`,
          );
        } else {
          console.warn("[shell] parseJsonOutput enabled but no valid JSON found in stdout");
        }
      } else if (stdout) {
        console.log(`[shell] stdout: ${truncate(stdout)}`);
      }

      if (stderr) console.log(`[shell] stderr: ${truncate(stderr)}`);
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
