import { useTimezoneContext } from "../contexts/TimezoneContext";
import { formatInTimezone } from "../hooks/useTimezone";

function formatTimeAgo(date: string | null): string {
  if (!date) return "—";
  const now = Date.now();
  const diffMs = now - new Date(date).getTime();

  if (diffMs < 0) {
    const absDiff = Math.abs(diffMs);
    if (absDiff < 60_000) return `in ${Math.floor(absDiff / 1000)}s`;
    if (absDiff < 3_600_000) return `in ${Math.floor(absDiff / 60_000)}m`;
    if (absDiff < 86_400_000) return `in ${Math.floor(absDiff / 3_600_000)}h`;
    return `in ${Math.floor(absDiff / 86_400_000)}d`;
  }

  if (diffMs < 60_000) return `${Math.floor(diffMs / 1000)}s ago`;
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return `${Math.floor(diffMs / 86_400_000)}d ago`;
}

export function TimeAgo({ date }: { date: string | null }) {
  const { timezone } = useTimezoneContext();
  const iso = date ?? "";
  const tooltip = date ? formatInTimezone(date, timezone) : "";
  return (
    <time className="text-sm" dateTime={iso} title={tooltip}>
      {formatTimeAgo(date)}
    </time>
  );
}
