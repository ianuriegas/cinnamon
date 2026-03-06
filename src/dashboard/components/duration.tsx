import type { FC } from "hono/jsx";

function formatDuration(startedAt: Date | null, finishedAt: Date | null): string {
  if (!startedAt) return "—";
  const end = finishedAt ?? new Date();
  const ms = end.getTime() - startedAt.getTime();

  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

export const Duration: FC<{ startedAt: Date | null; finishedAt: Date | null }> = ({
  startedAt,
  finishedAt,
}) => {
  return <span class="font-mono text-sm">{formatDuration(startedAt, finishedAt)}</span>;
};
