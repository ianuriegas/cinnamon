import { Loader2, Play } from "lucide-react";
import { useCallback, useState } from "react";
import { Link } from "react-router";
import { triggerJob } from "../lib/api";

export function TriggerButton({ jobName }: { jobName: string }) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "success"; jobId: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const trigger = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await triggerJob(jobName);
      if (res.error) {
        setState({ kind: "error", message: res.error });
      } else {
        setState({ kind: "success", jobId: res.jobId ?? "" });
      }
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to trigger",
      });
    }
  }, [jobName]);

  if (state.kind === "success") {
    return (
      <span className="text-xs" style={{ color: "var(--gruvbox-green-bright)" }}>
        Triggered →{" "}
        <Link to={`/runs/${state.jobId}`} className="underline underline-offset-2 hover:opacity-80">
          {state.jobId}
        </Link>
      </span>
    );
  }

  if (state.kind === "error") {
    return (
      <span className="text-xs" style={{ color: "var(--gruvbox-red-bright)" }}>
        Failed: {state.message}{" "}
        <button
          type="button"
          className="underline underline-offset-2 hover:opacity-80"
          onClick={trigger}
        >
          Retry
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className="px-3 py-1.5 text-xs rounded-lg transition-all flex items-center gap-1.5 shrink-0 hover:opacity-90 disabled:opacity-50"
      style={{
        backgroundColor: "var(--gruvbox-orange-bright)",
        color: "var(--gruvbox-bg0)",
      }}
      onClick={trigger}
      disabled={state.kind === "loading"}
    >
      {state.kind === "loading" ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Play className="w-3 h-3" />
      )}
      Trigger
    </button>
  );
}
