import { isDirectExecution } from "@/src/lib/is-direct-execution.ts";
import { runSpotifyTopTracksJob } from "./ingest.ts";
import type { SpotifyTopTracksJobPayload } from "./types.ts";

export { runSpotifyTopTracksJob } from "./ingest.ts";
export type { SpotifyTopTracksJobPayload } from "./types.ts";

function parseDirectExecutionPayload(args: string[]): SpotifyTopTracksJobPayload {
  const payload: SpotifyTopTracksJobPayload = {};

  for (const arg of args) {
    if (arg === "--dry" || arg === "--dry-run" || arg === "-d") {
      payload.dryRun = true;
      continue;
    }

    if (!arg.trim().startsWith("{")) {
      continue;
    }

    try {
      const parsed = JSON.parse(arg) as SpotifyTopTracksJobPayload;
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
  runSpotifyTopTracksJob(payload)
    .then((result) => {
      console.log(JSON.stringify(result));
    })
    .catch((error) => {
      console.error("Spotify top tracks job failed:", error);
      process.exit(1);
    });
}
