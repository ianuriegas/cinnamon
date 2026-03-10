/**
 * Example: Adding Spotify jobs to your cinnamon.config.ts
 *
 * Copy the job entries below into your own config file.
 * Requires SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REFRESH_TOKEN
 * environment variables. See examples/docs/spotify-auth.md for setup.
 */

// In your cinnamon.config.ts, add these entries under `jobs`:
const spotifyJobs = {
  "spotify-recently-played": {
    command: "bun",
    script: "./examples/jobs/spotify/recently-played/index.ts",
    schedule: "0 * * * *",
    timeout: "30s",
    parseJsonOutput: true,
    description: "Ingest Spotify recently played tracks",
  },

  "spotify-top-tracks": {
    command: "bun",
    script: "./examples/jobs/spotify/top-tracks/index.ts",
    schedule: "0 0 * * *",
    timeout: "60s",
    parseJsonOutput: true,
    description: "Snapshot top tracks by time range",
  },
};

export default spotifyJobs;
