import type { FC } from "hono/jsx";

import { Duration } from "../components/duration.tsx";
import { StatusBadge } from "../components/status-badge.tsx";
import { BaseLayout } from "../layouts/base.tsx";

export interface RunDetailRow {
  id: number;
  jobId: string;
  jobName: string;
  queueName: string;
  status: string;
  error: boolean;
  payload: unknown;
  result: unknown;
  logs: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
}

interface ShellResult {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  parsed?: Record<string, unknown> | null;
}

export function isShellResult(value: unknown): value is ShellResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return "stdout" in v || "stderr" in v || "exitCode" in v;
}

export function formatJson(value: unknown): string {
  if (value == null) return "null";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatTimestamp(date: Date | null): string {
  if (!date) return "—";
  return date.toISOString().replace("T", " ").replace("Z", " UTC");
}

const COPY_SCRIPT =
  "var b=this;navigator.clipboard.writeText(b.closest('.card-body').querySelector('code').textContent).then(function(){b.textContent='Copied!';setTimeout(function(){b.textContent='Copy'},1500)})";

const LogBlock: FC<{ title: string; content: string; variant?: string }> = ({
  title,
  content,
  variant,
}) => {
  const borderClass = variant === "error" ? "border-l-4 border-error" : "";
  return (
    <div class="card bg-base-100 shadow-sm">
      <div class="card-body">
        <div class="flex justify-between items-center">
          <h2 class="card-title text-sm">{title}</h2>
          <button class="btn btn-ghost btn-xs" onclick={COPY_SCRIPT}>
            Copy
          </button>
        </div>
        <pre
          class={`bg-base-200 rounded-lg p-4 text-xs overflow-x-auto max-h-[32rem] whitespace-pre-wrap break-words ${borderClass}`}
        >
          <code>{content}</code>
        </pre>
      </div>
    </div>
  );
};

const JsonBlock: FC<{ title: string; value: unknown }> = ({ title, value }) => (
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body">
      <div class="flex justify-between items-center">
        <h2 class="card-title text-sm">{title}</h2>
        <button class="btn btn-ghost btn-xs" onclick={COPY_SCRIPT}>
          Copy
        </button>
      </div>
      <pre class="bg-base-200 rounded-lg p-4 text-xs overflow-x-auto max-h-96 whitespace-pre-wrap break-words">
        <code>{formatJson(value)}</code>
      </pre>
    </div>
  </div>
);

export const RunDetailContent: FC<{ run: RunDetailRow }> = ({ run }) => {
  const shell = isShellResult(run.result) ? run.result : null;
  const isProcessing = run.status === "processing" || run.status === "queued";

  return (
    <div
      id="run-detail-content"
      {...(isProcessing
        ? {
            "hx-get": `/dashboard/partials/runs/${run.id}`,
            "hx-trigger": "every 2s",
            "hx-swap": "outerHTML",
          }
        : {})}
    >
      <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center mb-6">
        <h1 class="text-2xl font-bold font-mono">{run.jobName}</h1>
        <StatusBadge status={run.status} />
        {shell && typeof shell.exitCode === "number" && (
          <span
            class={`badge badge-sm ${shell.exitCode === 0 ? "badge-success" : "badge-error"}`}
          >
            exit {shell.exitCode}
          </span>
        )}
        {isProcessing && (
          <span class="loading loading-spinner loading-xs text-warning" />
        )}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div class="card bg-base-100 shadow-sm">
          <div class="card-body">
            <h2 class="card-title text-sm">Timing</h2>
            <dl class="grid grid-cols-2 gap-y-2 text-sm">
              <dt class="text-base-content/60">Duration</dt>
              <dd>
                <Duration startedAt={run.startedAt} finishedAt={run.finishedAt} />
              </dd>
              <dt class="text-base-content/60">Created</dt>
              <dd class="font-mono text-xs">{formatTimestamp(run.createdAt)}</dd>
              <dt class="text-base-content/60">Started</dt>
              <dd class="font-mono text-xs">{formatTimestamp(run.startedAt)}</dd>
              <dt class="text-base-content/60">Finished</dt>
              <dd class="font-mono text-xs">{formatTimestamp(run.finishedAt)}</dd>
            </dl>
          </div>
        </div>

        <div class="card bg-base-100 shadow-sm">
          <div class="card-body">
            <h2 class="card-title text-sm">Metadata</h2>
            <dl class="grid grid-cols-2 gap-y-2 text-sm">
              <dt class="text-base-content/60">Run ID</dt>
              <dd class="font-mono text-xs">{run.id}</dd>
              <dt class="text-base-content/60">Job ID</dt>
              <dd class="font-mono text-xs">{run.jobId}</dd>
              <dt class="text-base-content/60">Queue</dt>
              <dd class="font-mono text-xs">{run.queueName}</dd>
              <dt class="text-base-content/60">Error</dt>
              <dd>{run.error ? <span class="text-error">Yes</span> : "No"}</dd>
            </dl>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4">
        {run.logs ? (
          <LogBlock title="Console Logs" content={run.logs} />
        ) : (
          <div class="card bg-base-100 shadow-sm">
            <div class="card-body">
              <h2 class="card-title text-sm">Console Logs</h2>
              <p class="text-sm text-base-content/50">No logs captured for this run</p>
            </div>
          </div>
        )}

        {shell ? (
          <>
            {shell.stdout && <LogBlock title="stdout" content={shell.stdout} />}
            {shell.stderr && (
              <LogBlock title="stderr" content={shell.stderr} variant="error" />
            )}
            {shell.parsed && <JsonBlock title="Parsed Result" value={shell.parsed} />}
          </>
        ) : (
          <JsonBlock title="Result" value={run.result} />
        )}

        <JsonBlock title="Payload" value={run.payload} />
      </div>
    </div>
  );
};

export const RunDetailPage: FC<{ run: RunDetailRow }> = ({ run }) => {
  return (
    <BaseLayout title={`Run ${run.jobId}`} currentPath="/dashboard">
      <div class="mb-4 flex gap-2">
        <a href="/dashboard" class="btn btn-ghost btn-sm gap-1">
          ← Back to runs
        </a>
        <a
          href={`/dashboard/runs/${run.id}/raw`}
          target="_blank"
          class="btn btn-ghost btn-sm gap-1"
        >
          Raw Logs ↗
        </a>
      </div>

      <RunDetailContent run={run} />
    </BaseLayout>
  );
};
