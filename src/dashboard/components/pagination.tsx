import type { FC } from "hono/jsx";

interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  baseUrl: string;
  queryParams?: string;
}

export const Pagination: FC<PaginationProps> = ({
  total,
  limit,
  offset,
  baseUrl,
  queryParams,
}) => {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (totalPages <= 1) return null;

  const prevOffset = Math.max(0, offset - limit);
  const nextOffset = offset + limit;
  const qs = queryParams ? `&${queryParams}` : "";

  return (
    <div class="join mt-4 flex justify-center">
      {offset > 0 ? (
        <a
          href={`${baseUrl}?offset=${prevOffset}&limit=${limit}${qs}`}
          class="join-item btn btn-sm"
        >
          «
        </a>
      ) : (
        <button class="join-item btn btn-sm btn-disabled" disabled>
          «
        </button>
      )}
      <button class="join-item btn btn-sm btn-active">
        {currentPage} / {totalPages}
      </button>
      {nextOffset < total ? (
        <a
          href={`${baseUrl}?offset=${nextOffset}&limit=${limit}${qs}`}
          class="join-item btn btn-sm"
        >
          »
        </a>
      ) : (
        <button class="join-item btn btn-sm btn-disabled" disabled>
          »
        </button>
      )}
    </div>
  );
};
