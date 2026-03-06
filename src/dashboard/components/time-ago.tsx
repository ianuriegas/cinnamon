import type { FC } from "hono/jsx";

function formatTimeAgo(date: Date | null): string {
  if (!date) return "—";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 0) return "just now";
  if (diffMs < 60_000) return `${Math.floor(diffMs / 1000)}s ago`;
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return `${Math.floor(diffMs / 86_400_000)}d ago`;
}

export const TimeAgo: FC<{ date: Date | null }> = ({ date }) => {
  const iso = date ? date.toISOString() : "";
  return (
    <time class="text-sm" datetime={iso} title={iso}>
      {formatTimeAgo(date)}
    </time>
  );
};
