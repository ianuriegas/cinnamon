interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onPageChange: (offset: number) => void;
}

export function Pagination({ total, limit, offset, onPageChange }: PaginationProps) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (totalPages <= 1) return null;

  const prevOffset = Math.max(0, offset - limit);
  const nextOffset = offset + limit;

  const buttonBase = "px-3 py-1.5 text-sm rounded-lg border border-border transition-colors";

  return (
    <div className="mt-4 flex justify-center items-center gap-1">
      <button
        type="button"
        className={`${buttonBase} ${offset <= 0 ? "opacity-40 cursor-not-allowed" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
        disabled={offset <= 0}
        onClick={() => onPageChange(prevOffset)}
      >
        «
      </button>
      <span
        className="px-3 py-1.5 text-sm rounded-lg"
        style={{
          backgroundColor: "var(--gruvbox-orange-bright)",
          color: "var(--gruvbox-bg0)",
        }}
      >
        {currentPage} / {totalPages}
      </span>
      <button
        type="button"
        className={`${buttonBase} ${nextOffset >= total ? "opacity-40 cursor-not-allowed" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
        disabled={nextOffset >= total}
        onClick={() => onPageChange(nextOffset)}
      >
        »
      </button>
    </div>
  );
}
