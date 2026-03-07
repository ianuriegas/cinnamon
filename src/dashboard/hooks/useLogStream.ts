import { useCallback, useEffect, useRef, useState } from "react";
import { streamRunUrl } from "../lib/api";

export interface LogLine {
  id: number;
  stream: "stdout" | "stderr" | "log";
  text: string;
}

interface LogStreamState {
  lines: LogLine[];
  isStreaming: boolean;
  doneStatus: string | null;
}

export function useLogStream(jobId: string | undefined, enabled: boolean): LogStreamState {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [doneStatus, setDoneStatus] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const nextId = useRef(0);

  const cleanup = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  useEffect(() => {
    if (!enabled || !jobId) {
      cleanup();
      return;
    }

    setLines([]);
    setDoneStatus(null);
    setIsStreaming(true);
    nextId.current = 0;

    const url = streamRunUrl(jobId);
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.addEventListener("log", (e) => {
      try {
        const data = JSON.parse(e.data);
        setLines((prev) => [...prev, { id: nextId.current++, stream: "log", text: data.text }]);
      } catch {
        // ignore
      }
    });

    es.addEventListener("chunk", (e) => {
      try {
        const data = JSON.parse(e.data);
        const stream = data.stream === "stderr" ? "stderr" : "stdout";
        setLines((prev) => [...prev, { id: nextId.current++, stream, text: data.text }]);
      } catch {
        // ignore
      }
    });

    es.addEventListener("done", (e) => {
      try {
        const data = JSON.parse(e.data);
        setDoneStatus(data.status ?? "unknown");
      } catch {
        // ignore
      }
      es.close();
      esRef.current = null;
      setIsStreaming(false);
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setIsStreaming(false);
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [jobId, enabled, cleanup]);

  return { lines, isStreaming, doneStatus };
}
