import { ArrowLeft, ExternalLink, Loader2, MoreHorizontal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { CopyButton } from "../components/CopyButton";
import { Duration } from "../components/Duration";
import { useTimezoneContext } from "../contexts/TimezoneContext";
import { type LogLine, useLogStream } from "../hooks/useLogStream";
import { usePolling } from "../hooks/usePolling";
import { formatInTimezone } from "../hooks/useTimezone";
import { cancelRun, fetchRun, retryRun } from "../lib/api";
import type { RunRow } from "../lib/types";
import { formatJson, isShellResult } from "../lib/types";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground text-right">{value}</span>
    </div>
  );
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
  const borderClass = variant === "error" ? "border-l-4" : "";
  const borderStyle =
    variant === "error" ? { borderLeftColor: "var(--gruvbox-red-bright)" } : undefined;
  return (
    <div className="bg-card border border-border rounded-xl">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h3 className="text-foreground">{title}</h3>
        <CopyButton getText={() => codeRef.current?.textContent ?? ""} />
      </div>
      <div className="p-6">
        <pre
          className={`text-sm text-foreground font-mono whitespace-pre-wrap break-words ${borderClass}`}
          style={borderStyle}
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
      <div className="bg-card border border-border rounded-xl">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
          <h3 className="text-foreground">Live Output</h3>
          <MoreHorizontal
            className="w-4 h-4 animate-pulse"
            style={{ color: "var(--gruvbox-yellow-bright)" }}
          />
        </div>
        <div className="p-6">
          <p className="text-sm text-muted-foreground">Waiting for output...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
        <h3 className="text-foreground">Live Output</h3>
        <Loader2
          className="w-4 h-4 animate-spin"
          style={{ color: "var(--gruvbox-yellow-bright)" }}
        />
      </div>
      <div className="p-6">
        <pre
          ref={containerRef}
          onScroll={handleScroll}
          className="text-sm text-foreground font-mono whitespace-pre-wrap break-words max-h-[32rem] overflow-y-auto"
        >
          <code>
            {lines.map((line) => (
              <span
                key={line.id}
                className="block"
                style={
                  line.stream === "stderr" ? { color: "var(--gruvbox-red-bright)" } : undefined
                }
              >
                {line.text}
              </span>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  const codeRef = useRef<HTMLElement>(null);
  return (
    <div className="bg-card border border-border rounded-xl">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h3 className="text-foreground">{title}</h3>
        <CopyButton getText={() => codeRef.current?.textContent ?? ""} />
      </div>
      <div className="p-6">
        <pre className="text-sm text-foreground font-mono whitespace-pre-wrap break-words">
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
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
      style={{ backgroundColor: "var(--destructive)", color: "var(--destructive-foreground)" }}
      onClick={handleCancel}
      disabled={cancelling}
    >
      {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Cancel"}
    </button>
  );
}

function RetryButton({ jobId, onRetried }: { jobId: string; onRetried: () => void }) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    try {
      await retryRun(jobId);
      onRetried();
    } catch {
      // polling will pick up the actual status
    } finally {
      setRetrying(false);
    }
  }, [jobId, onRetried]);

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
      style={{ backgroundColor: "var(--gruvbox-orange-bright)", color: "var(--gruvbox-bg0)" }}
      onClick={handleRetry}
      disabled={retrying}
    >
      {retrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Retry"}
    </button>
  );
}

export function RunDetailPage() {
  const { timezone } = useTimezoneContext();
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
  const isRetryable = ["failed", "cancelled", "interrupted"].includes(run?.status ?? "");
  usePolling(load, 2000, isActive);

  const isProcessing = run?.status === "processing";
  const { lines: streamLines, isStreaming } = useLogStream(run?.jobId, isProcessing === true);

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-foreground mb-4">Run not found</h2>
        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Back to runs
        </Link>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const shell = isShellResult(run.result) ? run.result : null;

  const statusColor =
    run.status === "completed"
      ? "var(--gruvbox-green)"
      : run.status === "processing" || run.status === "queued"
        ? "var(--gruvbox-blue-bright)"
        : "var(--gruvbox-red-bright)";

  return (
    <>
      {/* Back button and Raw Logs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to runs
        </Link>
        <a
          href={`/api/dashboard/runs/${run.jobId}/raw`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Raw Logs
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <h1 className="text-foreground font-mono">{run.jobName}</h1>
        <span
          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
          style={{ backgroundColor: statusColor, color: "var(--gruvbox-bg0)" }}
        >
          {run.status}
        </span>
        {shell && typeof shell.exitCode === "number" && (
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
            style={{ backgroundColor: "var(--gruvbox-yellow)", color: "var(--gruvbox-bg0)" }}
          >
            exit {shell.exitCode}
          </span>
        )}
        {isActive && (
          <Loader2
            className="w-4 h-4 animate-spin"
            style={{ color: "var(--gruvbox-yellow-bright)" }}
          />
        )}
        {isActive && <CancelButton jobId={run.jobId} onCancelled={load} />}
        {isRetryable && <RetryButton jobId={run.jobId} onRetried={load} />}
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-foreground mb-4">Timing</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-start gap-4">
              <span className="text-sm text-muted-foreground">Duration</span>
              <span className="text-sm text-foreground text-right">
                <Duration startedAt={run.startedAt} finishedAt={run.finishedAt} />
              </span>
            </div>
            <InfoRow label="Created" value={formatInTimezone(run.createdAt, timezone)} />
            <InfoRow label="Started" value={formatInTimezone(run.startedAt, timezone)} />
            <InfoRow label="Finished" value={formatInTimezone(run.finishedAt, timezone)} />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-foreground mb-4">Metadata</h3>
          <div className="space-y-3">
            <InfoRow label="Run ID" value={String(run.id)} />
            <InfoRow label="Job ID" value={run.jobId} />
            <InfoRow label="Queue" value={run.queueName} />
            <InfoRow label="Error" value={run.error ? "Yes" : "No"} />
          </div>
        </div>
      </div>

      {/* Logs / Streaming / Payload */}
      <div className="grid grid-cols-1 gap-6">
        {isStreaming || (isProcessing && streamLines.length > 0) ? (
          <StreamingLogBlock lines={streamLines} />
        ) : (
          <>
            {run.logs ? (
              <LogBlock title="Logs" content={run.logs} />
            ) : (
              !isActive && (
                <div className="bg-card border border-border rounded-xl">
                  <div className="px-6 py-4 border-b border-border">
                    <h3 className="text-foreground">Logs</h3>
                  </div>
                  <div className="p-6">
                    <p className="text-sm text-muted-foreground">No logs captured for this run</p>
                  </div>
                </div>
              )
            )}

            {shell ? (
              <>
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
