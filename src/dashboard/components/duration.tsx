function formatDuration(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt) return "—";
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const ms = end - new Date(startedAt).getTime();

  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

export function Duration({
  startedAt,
  finishedAt,
}: {
  startedAt: string | null;
  finishedAt: string | null;
}) {
  return <span className="font-mono text-sm">{formatDuration(startedAt, finishedAt)}</span>;
}
