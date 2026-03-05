import type { JobHandler } from "@/src/job-types.ts";
import { runCinnamonJob } from "./cinnamon/index.ts";
import { runShellJob } from "./shell/index.ts";
import { runSpotifyRecentlyPlayedJob } from "./spotify/recently-played/index.ts";
import { runSpotifyTopTracksJob } from "./spotify/top-tracks/index.ts";

export const jobHandlers: Record<string, JobHandler> = {
  cinnamon: runCinnamonJob as JobHandler,
  shell: runShellJob as JobHandler,
  "spotify-recently-played": runSpotifyRecentlyPlayedJob as JobHandler,
  "spotify-top-tracks": runSpotifyTopTracksJob as JobHandler,
};
