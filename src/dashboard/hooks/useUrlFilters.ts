import { useCallback } from "react";
import { useSearchParams } from "react-router";

interface UseUrlFiltersOptions {
  /** Keys that should NOT be counted toward `activeFilterCount` (e.g. "q", "filters", "tab"). */
  excludeFromCount?: string[];
  /** Keys to reset when any non-pagination filter changes (e.g. "offset"). */
  resetOnChange?: string[];
}

export function useUrlFilters<K extends string = string>(
  filterKeys: readonly K[],
  options: UseUrlFiltersOptions = {},
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { excludeFromCount = [], resetOnChange = [] } = options;

  const filters = Object.fromEntries(
    filterKeys.map((k) => [k, searchParams.get(k) ?? ""]),
  ) as Record<K, string>;

  const setFilter = useCallback(
    (key: K, value: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(key, value);
          else next.delete(key);
          for (const rk of resetOnChange) {
            if (key !== rk) next.delete(rk);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, resetOnChange],
  );

  const clearFilters = useCallback(
    (keys?: K[]) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const toClear = keys ?? filterKeys.filter((k) => !excludeFromCount.includes(k));
          for (const k of toClear) next.delete(k);
          for (const rk of resetOnChange) next.delete(rk);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, filterKeys, excludeFromCount, resetOnChange],
  );

  const activeFilterCount = filterKeys.filter(
    (k) => !excludeFromCount.includes(k) && filters[k],
  ).length;

  return { filters, setFilter, clearFilters, activeFilterCount, searchParams, setSearchParams };
}
