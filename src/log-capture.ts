const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === "string") return arg;
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    })
    .join(" ");
}

export interface CapturedLogs {
  lines: string[];
}

export interface CaptureOptions {
  onLine?: (line: string) => void;
}

/**
 * Intercepts console.log/warn/error/info during an async function,
 * collects all output, then restores the originals.
 * Logs still go to stdout/stderr as usual.
 * If onLine is provided, each captured line is emitted incrementally.
 */
export async function captureConsoleLogs<T>(
  fn: () => Promise<T>,
  options?: CaptureOptions,
): Promise<{ result: T; logs: string }> {
  const captured: CapturedLogs = { lines: [] };
  const { onLine } = options ?? {};

  const push = (level: string, args: unknown[]) => {
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level}] ${formatArgs(args)}`;
    captured.lines.push(line);
    onLine?.(line);
  };

  console.log = (...args: unknown[]) => {
    push("LOG", args);
    originalConsoleLog.apply(console, args);
  };
  console.error = (...args: unknown[]) => {
    push("ERROR", args);
    originalConsoleError.apply(console, args);
  };
  console.warn = (...args: unknown[]) => {
    push("WARN", args);
    originalConsoleWarn.apply(console, args);
  };
  console.info = (...args: unknown[]) => {
    push("INFO", args);
    originalConsoleInfo.apply(console, args);
  };

  try {
    const result = await fn();
    return { result, logs: captured.lines.join("\n") };
  } finally {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    console.info = originalConsoleInfo;
  }
}
