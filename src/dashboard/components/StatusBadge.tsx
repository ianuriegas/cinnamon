const STATUS_STYLES: Record<string, string> = {
  queued: "badge-info",
  completed: "badge-success",
  failed: "badge-error",
  processing: "badge-warning",
  cancelled: "badge-neutral",
  interrupted: "badge-warning",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "badge-ghost";
  return <span className={`badge ${style} badge-sm gap-1`}>{status}</span>;
}
