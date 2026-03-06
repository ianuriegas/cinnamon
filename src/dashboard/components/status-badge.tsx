import type { FC } from "hono/jsx";

const STATUS_STYLES: Record<string, string> = {
  queued: "badge-info",
  completed: "badge-success",
  failed: "badge-error",
  processing: "badge-warning",
};

export const StatusBadge: FC<{ status: string }> = ({ status }) => {
  const style = STATUS_STYLES[status] ?? "badge-ghost";
  return <span class={`badge ${style} badge-sm gap-1`}>{status}</span>;
};
