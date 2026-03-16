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
      <span className="text-success text-xs">
        Triggered →{" "}
        <Link to={`/runs/${state.jobId}`} className="link">
          {state.jobId}
        </Link>
      </span>
    );
  }

  if (state.kind === "error") {
    return (
      <span className="text-error text-xs">
        Failed: {state.message}{" "}
        <button type="button" className="btn btn-ghost btn-xs" onClick={trigger}>
          Retry
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className="btn btn-primary btn-xs"
      onClick={trigger}
      disabled={state.kind === "loading"}
    >
      {state.kind === "loading" ? (
        <span className="loading loading-spinner loading-xs" />
      ) : (
        "Trigger"
      )}
    </button>
  );
}
