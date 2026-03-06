import { isDirectExecution } from "../../_shared/is-direct-execution.ts";
import { runSpotifyRecentlyPlayedJob } from "./ingest.ts";
import type { SpotifyRecentlyPlayedJobPayload } from "./types.ts";

export { runSpotifyRecentlyPlayedJob } from "./ingest.ts";
export type { SpotifyRecentlyPlayedJobPayload } from "./types.ts";

function parseDirectExecutionPayload(args: string[]): SpotifyRecentlyPlayedJobPayload {
  const payload: SpotifyRecentlyPlayedJobPayload = {};

  for (const arg of args) {
    if (arg === "--dry" || arg === "--dry-run" || arg === "-d") {
      payload.dryRun = true;
      continue;
    }

    if (!arg.trim().startsWith("{")) {
      continue;
    }

    try {
      const parsed = JSON.parse(arg) as SpotifyRecentlyPlayedJobPayload;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { ...payload, ...parsed };
      }
    } catch {
      // Ignore invalid JSON input and keep scanning args.
    }
  }

  return payload;
}

if (isDirectExecution(import.meta.url)) {
  const payload = parseDirectExecutionPayload(process.argv.slice(2));
  runSpotifyRecentlyPlayedJob(payload)
    .then((result) => {
      console.log(JSON.stringify(result));
    })
    .catch((error) => {
      console.error("Spotify recently played job failed:", error);
      process.exit(1);
    });
}
