const useColor = !process.env.NO_COLOR;

const RESET = useColor ? "\x1b[0m" : "";
const BOLD = useColor ? "\x1b[1m" : "";
const DIM = useColor ? "\x1b[2m" : "";
const GREEN = useColor ? "\x1b[32m" : "";
const RED = useColor ? "\x1b[31m" : "";
const YELLOW = useColor ? "\x1b[33m" : "";
const CYAN = useColor ? "\x1b[36m" : "";

export function bold(s: string): string {
  return `${BOLD}${s}${RESET}`;
}

export function dim(s: string): string {
  return `${DIM}${s}${RESET}`;
}

export function cyan(s: string): string {
  return `${CYAN}${s}${RESET}`;
}

export function statusColor(status: string): string {
  switch (status) {
    case "completed":
      return `${GREEN}${status}${RESET}`;
    case "failed":
      return `${RED}${status}${RESET}`;
    case "running":
    case "active":
      return `${YELLOW}${status}${RESET}`;
    default:
      return status;
  }
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

export function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => {
    const cellWidths = rows.map((r) => stripAnsi(r[i] ?? "").length);
    return Math.max(h.length, ...cellWidths);
  });

  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join("  ");
  const separator = widths.map((w) => "─".repeat(w)).join("──");
  const body = rows.map((row) =>
    row
      .map((cell, i) => {
        const visible = stripAnsi(cell);
        const padding = widths[i] - visible.length;
        return cell + " ".repeat(Math.max(0, padding));
      })
      .join("  "),
  );

  return [bold(headerLine), dim(separator), ...body].join("\n");
}

export function formatDuration(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt) return dim("—");
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

export function formatTimestamp(iso: string | null): string {
  if (!iso) return dim("—");
  const d = new Date(iso);
  return d.toLocaleString();
}
