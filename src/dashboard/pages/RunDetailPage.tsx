import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { CopyButton } from "../components/CopyButton";
import { Duration } from "../components/Duration";
import { StatusBadge } from "../components/StatusBadge";
import { type LogLine, useLogStream } from "../hooks/useLogStream";
import { usePolling } from "../hooks/usePolling";
import { cancelRun, fetchRun } from "../lib/api";
import type { RunRow } from "../lib/types";
import { formatJson, isShellResult } from "../lib/types";

function formatTimestamp(date: string | null): string {
  if (!date) return "—";
  return date.replace("T", " ").replace("Z", " UTC");
}

function LogBlock({
  title,
  content,
  variant,
}: {
  title: string;
  content: string;
  variant?: string;
}) {
  const codeRef = useRef<HTMLElement>(null);
  const borderClass = variant === "error" ? "border-l-4 border-error" : "";
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body">
        <div className="flex justify-between items-center">
          <h2 className="card-title text-sm">{title}</h2>
          <CopyButton getText={() => codeRef.current?.textContent ?? ""} />
        </div>
        <pre
          className={`bg-base-200 rounded-lg p-4 text-xs overflow-x-auto max-h-[32rem] whitespace-pre-wrap break-words ${borderClass}`}
        >
          <code ref={codeRef}>{content}</code>
        </pre>
      </div>
    </div>
  );
}

function StreamingLogBlock({ lines }: { lines: LogLine[] }) {
  const containerRef = useRef<HTMLPreElement>(null);
  const shouldAutoScroll = useRef(true);

  const lineCount = lines.length;
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when new lines arrive
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !shouldAutoScroll.current) return;
    el.scrollTop = el.scrollHeight;
  }, [lineCount]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    shouldAutoScroll.current = atBottom;
  }

  if (lines.length === 0) {
    return (
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <div className="flex items-center gap-2">
            <h2 className="card-title text-sm">Live Output</h2>
            <span className="loading loading-dots loading-xs text-warning" />
          </div>
          <p className="text-sm text-base-content/50">Waiting for output...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body">
        <div className="flex items-center gap-2">
          <h2 className="card-title text-sm">Live Output</h2>
          <span className="loading loading-dots loading-xs text-warning" />
        </div>
        <pre
          ref={containerRef}
          onScroll={handleScroll}
          className="bg-base-200 rounded-lg p-4 text-xs overflow-x-auto max-h-[32rem] whitespace-pre-wrap break-words overflow-y-auto"
        >
          <code>
            {lines.map((line) => {
              const cls = line.stream === "stderr" ? "text-error" : "";
              return (
                <span key={line.id} className={cls}>
                  {line.text}
                </span>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  const codeRef = useRef<HTMLElement>(null);
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body">
        <div className="flex justify-between items-center">
          <h2 className="card-title text-sm">{title}</h2>
          <CopyButton getText={() => codeRef.current?.textContent ?? ""} />
        </div>
        <pre className="bg-base-200 rounded-lg p-4 text-xs overflow-x-auto max-h-96 whitespace-pre-wrap break-words">
          <code ref={codeRef}>{formatJson(value)}</code>
        </pre>
      </div>
    </div>
  );
}

function CancelButton({ jobId, onCancelled }: { jobId: string; onCancelled: () => void }) {
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = useCallback(async () => {
    setCancelling(true);
    try {
      await cancelRun(jobId);
      onCancelled();
    } catch {
      // polling will pick up the actual status
    } finally {
      setCancelling(false);
    }
  }, [jobId, onCancelled]);

  return (
    <button
      type="button"
      className="btn btn-error btn-sm gap-1"
      onClick={handleCancel}
      disabled={cancelling}
    >
      {cancelling ? <span className="loading loading-spinner loading-xs" /> : "Cancel"}
    </button>
  );
}

export function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<RunRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetchRun(id);
      setRun(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load run");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const isActive = run?.status === "processing" || run?.status === "queued";
  usePolling(load, 2000, isActive);

  const isProcessing = run?.status === "processing";
  const { lines: streamLines, isStreaming } = useLogStream(run?.jobId, isProcessing === true);

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-error">{error}</p>
        <Link to="/" className="btn btn-sm btn-primary mt-4">
          ← Back to runs
        </Link>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  const shell = isShellResult(run.result) ? run.result : null;

  return (
    <>
      <div className="mb-4 flex gap-2">
        <Link to="/" className="btn btn-ghost btn-sm gap-1">
          ← Back to runs
        </Link>
        <a
          href={`/api/dashboard/runs/${run.jobId}/raw`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost btn-sm gap-1"
        >
          Raw Logs ↗
        </a>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center mb-6">
        <h1 className="text-2xl font-bold font-mono">{run.jobName}</h1>
        <StatusBadge status={run.status} />
        {shell && typeof shell.exitCode === "number" && (
          <span
            className={`badge badge-sm ${shell.exitCode === 0 ? "badge-success" : "badge-error"}`}
          >
            exit {shell.exitCode}
          </span>
        )}
        {isActive && <span className="loading loading-spinner loading-xs text-warning" />}
        {isActive && <CancelButton jobId={run.jobId} onCancelled={load} />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-sm">Timing</h2>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-base-content/60">Duration</dt>
              <dd>
                <Duration startedAt={run.startedAt} finishedAt={run.finishedAt} />
              </dd>
              <dt className="text-base-content/60">Created</dt>
              <dd className="font-mono text-xs">{formatTimestamp(run.createdAt)}</dd>
              <dt className="text-base-content/60">Started</dt>
              <dd className="font-mono text-xs">{formatTimestamp(run.startedAt)}</dd>
              <dt className="text-base-content/60">Finished</dt>
              <dd className="font-mono text-xs">{formatTimestamp(run.finishedAt)}</dd>
            </dl>
          </div>
        </div>

        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-sm">Metadata</h2>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-base-content/60">Run ID</dt>
              <dd className="font-mono text-xs">{run.id}</dd>
              <dt className="text-base-content/60">Job ID</dt>
              <dd className="font-mono text-xs">{run.jobId}</dd>
              <dt className="text-base-content/60">Queue</dt>
              <dd className="font-mono text-xs">{run.queueName}</dd>
              <dt className="text-base-content/60">Error</dt>
              <dd>{run.error ? <span className="text-error">Yes</span> : "No"}</dd>
            </dl>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isStreaming || (isProcessing && streamLines.length > 0) ? (
          <StreamingLogBlock lines={streamLines} />
        ) : (
          <>
            {run.logs ? (
              <LogBlock title="Console Logs" content={run.logs} />
            ) : (
              !isActive && (
                <div className="card bg-base-100 shadow-sm">
                  <div className="card-body">
                    <h2 className="card-title text-sm">Console Logs</h2>
                    <p className="text-sm text-base-content/50">No logs captured for this run</p>
                  </div>
                </div>
              )
            )}

            {shell ? (
              <>
                {shell.stdout && <LogBlock title="stdout" content={shell.stdout} />}
                {shell.stderr && <LogBlock title="stderr" content={shell.stderr} variant="error" />}
                {shell.parsed && <JsonBlock title="Parsed Result" value={shell.parsed} />}
              </>
            ) : (
              !isActive && <JsonBlock title="Result" value={run.result} />
            )}
          </>
        )}

        {!isActive && <JsonBlock title="Payload" value={run.payload} />}
      </div>
    </>
  );
}
