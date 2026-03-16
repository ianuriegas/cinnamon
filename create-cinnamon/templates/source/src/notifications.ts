import type { NotificationConfig } from "@/config/define-config.ts";

export interface JobEvent {
  jobName: string;
  jobId: string;
  status: "completed" | "failed";
  durationMs: number | null;
  error?: string;
  result?: unknown;
}

type Platform = "discord" | "slack" | "generic";

/**
 * Resolves ${VAR} references in a URL from process.env.
 * Returns empty string if the entire URL was an unresolved variable.
 */
function interpolateUrl(url: string): string {
  return url.replace(/\$\{(\w+)\}/g, (_, name) => process.env[name] ?? "");
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1_000;

function detectPlatform(url: string): Platform {
  if (url.includes("discord.com/api/webhooks")) return "discord";
  if (url.includes("hooks.slack.com")) return "slack";
  return "generic";
}

function formatDiscordPayload(event: JobEvent): unknown {
  const isFailure = event.status === "failed";
  const color = isFailure ? 0xed4245 : 0x57f287;
  const emoji = isFailure ? "🔴" : "🟢";
  const title = `${emoji} Job ${event.status}: ${event.jobName}`;

  const fields: { name: string; value: string; inline: boolean }[] = [
    { name: "Job", value: `\`${event.jobName}\``, inline: true },
    { name: "Status", value: event.status, inline: true },
  ];

  if (event.jobId) {
    fields.push({ name: "Job ID", value: `\`${event.jobId}\``, inline: true });
  }

  if (event.durationMs != null) {
    fields.push({ name: "Duration", value: formatDuration(event.durationMs), inline: true });
  }

  if (isFailure && event.error) {
    const truncated = event.error.length > 1024 ? `${event.error.slice(0, 1021)}...` : event.error;
    fields.push({ name: "Error", value: `\`\`\`${truncated}\`\`\``, inline: false });
  }

  return {
    embeds: [
      {
        title,
        color,
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: "Cinnamon" },
      },
    ],
  };
}

function formatSlackPayload(event: JobEvent): unknown {
  const isFailure = event.status === "failed";
  const emoji = isFailure ? ":red_circle:" : ":large_green_circle:";
  const header = `${emoji} Job ${event.status}: *${event.jobName}*`;

  const fields = [
    { type: "mrkdwn", text: `*Job:* \`${event.jobName}\`` },
    { type: "mrkdwn", text: `*Status:* ${event.status}` },
  ];

  if (event.jobId) {
    fields.push({ type: "mrkdwn", text: `*Job ID:* \`${event.jobId}\`` });
  }

  if (event.durationMs != null) {
    fields.push({ type: "mrkdwn", text: `*Duration:* ${formatDuration(event.durationMs)}` });
  }

  const blocks: unknown[] = [
    { type: "section", text: { type: "mrkdwn", text: header } },
    { type: "section", fields },
  ];

  if (isFailure && event.error) {
    const truncated = event.error.length > 2048 ? `${event.error.slice(0, 2045)}...` : event.error;
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Error:*\n\`\`\`${truncated}\`\`\`` },
    });
  }

  return { blocks };
}

function formatGenericPayload(event: JobEvent): unknown {
  return {
    job_name: event.jobName,
    job_id: event.jobId,
    status: event.status,
    duration_ms: event.durationMs,
    error: event.error ?? null,
    timestamp: new Date().toISOString(),
  };
}

function formatPayload(platform: Platform, event: JobEvent): unknown {
  switch (platform) {
    case "discord":
      return formatDiscordPayload(event);
    case "slack":
      return formatSlackPayload(event);
    case "generic":
      return formatGenericPayload(event);
  }
}

function formatDuration(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendWebhook(url: string, payload: unknown): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) return;

      // Discord/Slack return 204/200 on success; treat 4xx as permanent failure
      if (response.status >= 400 && response.status < 500) {
        console.error(`[notifications] Webhook returned ${response.status} (not retrying): ${url}`);
        return;
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    if (attempt < MAX_RETRIES) {
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }

  console.error(
    `[notifications] Webhook failed after ${MAX_RETRIES + 1} attempts: ${url}`,
    lastError,
  );
}

/**
 * Fire all webhooks for a job event. Non-blocking — failures are logged
 * but never propagated to the caller.
 */
export async function fireNotifications(
  notifications: NotificationConfig | undefined,
  event: JobEvent,
): Promise<void> {
  if (!notifications) return;

  const targets = event.status === "failed" ? notifications.on_failure : notifications.on_success;

  if (!targets?.length) return;

  const promises = targets.map((target) => {
    const url = interpolateUrl(target.url);
    if (!url) {
      console.warn(
        `[notifications] Skipping empty webhook URL for ${event.jobName} (unresolved env var?)`,
      );
      return Promise.resolve();
    }
    const platform = detectPlatform(url);
    const payload = formatPayload(platform, event);
    return sendWebhook(url, payload).catch((err) => {
      console.error(`[notifications] Unexpected error dispatching to ${url}:`, err);
    });
  });

  await Promise.allSettled(promises);
}

// Exported for testing
export {
  detectPlatform,
  formatDiscordPayload,
  formatSlackPayload,
  formatGenericPayload,
  formatDuration,
  interpolateUrl,
};
