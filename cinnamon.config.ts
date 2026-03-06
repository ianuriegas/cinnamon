import { defineConfig } from "./config/define-config.ts";

export default defineConfig({
  jobs: {
    "hello-world": {
      command: "python3",
      script: "./jobs/shell/scripts/hello.py",
      timeout: "30s",
      // schedule: "0 * * * *",  // uncomment to run hourly
      description: "Demo Python script",
      notifications: {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: ${VAR} interpolation
        on_failure: [{ url: "${DISCORD_WEBHOOK_URL}" }],
        // biome-ignore lint/suspicious/noTemplateCurlyInString: ${VAR} interpolation
        on_success: [{ url: "${DISCORD_WEBHOOK_URL}" }],
      },
    },

    // Demo jobs for execution policies
    "env-demo": {
      command: "printenv",
      args: ["GREETING"],
      env: { GREETING: "hello from cinnamon" },
      cwd: "/tmp",
      timeout: "10s",
      retries: 2,
      description: "Demo of Phase 6 execution policies",
    },
    "fail-demo": {
      command: "bash",
      args: ["-c", "echo 'attempt!' && exit 1"],
      retries: 3,
      timeout: "5s",
      description: "Intentionally fails to test retries",
    },
    "interp-demo": {
      command: "printenv",
      args: ["DB_HOST"],
      // biome-ignore lint/suspicious/noTemplateCurlyInString: ${VAR} interpolation
      env: { DB_HOST: "${DATABASE_URL}" },
      timeout: "5s",
      description: "Test env var interpolation from host",
    },

    cinnamon: {
      command: "bun",
      script: "./jobs/cinnamon/index.ts",
      timeout: "30s",
      description: "Cinnamon countdown demo job",
    },

    "spotify-recently-played": {
      command: "bun",
      script: "./jobs/spotify/recently-played/index.ts",
      schedule: "0 * * * *",
      timeout: "30s",
      parseJsonOutput: true,
      description: "Ingest Spotify recently played tracks",
      notifications: {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: ${VAR} interpolation
        on_failure: [{ url: "${DISCORD_WEBHOOK_URL}" }],
      },
    },

    "spotify-top-tracks": {
      command: "bun",
      script: "./jobs/spotify/top-tracks/index.ts",
      schedule: "0 0 * * *",
      timeout: "60s",
      parseJsonOutput: true,
      description: "Snapshot top tracks by time range",
      notifications: {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: ${VAR} interpolation
        on_failure: [{ url: "${DISCORD_WEBHOOK_URL}" }],
      },
    },
  },
});
