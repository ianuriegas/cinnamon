const STATUS_COLORS: Record<string, string> = {
  completed: "var(--gruvbox-green)",
  processing: "var(--gruvbox-blue-bright)",
  queued: "var(--gruvbox-yellow)",
  failed: "var(--gruvbox-red-bright)",
  cancelled: "var(--gruvbox-bg4)",
  interrupted: "var(--gruvbox-orange)",
};

export function StatusBadge({ status }: { status: string }) {
  const bg = STATUS_COLORS[status] ?? "var(--gruvbox-bg4)";
  return (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: bg, color: "var(--gruvbox-bg0)" }}
    >
      {status}
    </span>
  );
}
