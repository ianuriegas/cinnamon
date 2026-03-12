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
        on_failure: [{ url: "${DISCORD_WEBHOOK_URL}" }],
        on_success: [{ url: "${DISCORD_WEBHOOK_URL}" }],
      },
    },
    "slow-job": {
      command: "python3",
      script: "./jobs/shell/scripts/slow.py",
      timeout: "60s",
      description: "Long-running job for testing cancel and live streaming",
    },
    cinnamon: {
      command: "bun",
      script: "./jobs/cinnamon/index.ts",
      timeout: "30s",
      description: "Cinnamon countdown demo job",
    },
  },
});
