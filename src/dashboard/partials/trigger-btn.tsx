import type { FC } from "hono/jsx";

export const TriggerButton: FC<{ jobName: string }> = ({ jobName }) => {
  return (
    <button
      class="btn btn-primary btn-xs"
      hx-post={`/dashboard/trigger/${jobName}`}
      hx-swap="outerHTML"
      hx-confirm={`Trigger job "${jobName}"?`}
    >
      Trigger
    </button>
  );
};

export const TriggerResult: FC<{ jobName: string; jobId?: string; error?: string }> = ({
  jobName,
  jobId,
  error,
}) => {
  if (error) {
    return (
      <span class="text-error text-xs">
        Failed: {error}{" "}
        <button
          class="btn btn-ghost btn-xs"
          hx-post={`/dashboard/trigger/${jobName}`}
          hx-swap="outerHTML"
          hx-confirm={`Trigger job "${jobName}"?`}
        >
          Retry
        </button>
      </span>
    );
  }

  return (
    <span class="text-success text-xs">
      Triggered →{" "}
      <a href={`/dashboard/runs/${jobId}`} class="link" hx-boost="false">
        {jobId}
      </a>
    </span>
  );
};
