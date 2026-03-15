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

  return (
    <div className="join mt-4 flex justify-center">
      <button
        type="button"
        className="join-item btn btn-sm"
        disabled={offset <= 0}
        onClick={() => onPageChange(prevOffset)}
      >
        «
      </button>
      <button type="button" className="join-item btn btn-sm btn-active">
        {currentPage} / {totalPages}
      </button>
      <button
        type="button"
        className="join-item btn btn-sm"
        disabled={nextOffset >= total}
        onClick={() => onPageChange(nextOffset)}
      >
        »
      </button>
    </div>
  );
}
