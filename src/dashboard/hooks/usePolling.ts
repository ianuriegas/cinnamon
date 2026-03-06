import { useCallback, useEffect, useRef } from "react";

export function usePolling(fn: () => void | Promise<void>, intervalMs: number, enabled = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const poll = useCallback(async () => {
    try {
      await fnRef.current();
    } catch {
      // swallow — caller handles errors in their own state
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        poll();
      }
    }, intervalMs);

    return () => clearInterval(id);
  }, [poll, intervalMs, enabled]);
}
