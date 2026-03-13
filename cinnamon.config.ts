import { defineConfig } from "./config/define-config.ts";

export default defineConfig({
  jobs: {
    "hello-world": {
      command: "uv",
      args: ["run", "--project", "./jobs/hello-world", "./jobs/hello-world/hello.py"],
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
      script: "./jobs/slow-job/slow.py",
      timeout: "60s",
      description: "Long-running job for testing cancel and live streaming",
    },
    cinnamon: {
      command: "bun",
      script: "./jobs/cinnamon/index.ts",
      timeout: "30s",
      description: "Cinnamon countdown demo job",
    },
    "require-package-ts": {
      command: "bun",
      script: "./jobs/require-package-ts/index.ts",
      timeout: "30s",
      description: "TypeScript job that imports nanoid (tests package loading)",
    },
    "require-package-py": {
      command: "uv",
      args: [
        "run",
        "--project",
        "./jobs/require-package-py",
        "./jobs/require-package-py/script.py",
      ],
      timeout: "30s",
      description: "Python job that imports humanize via uv (tests package loading)",
    },
    retention: {
      command: "bun",
      script: "./jobs/retention/index.ts",
      args: ["60"],
      timeout: "5m",
      schedule: "0 3 * * *",
      description: "Prune job runs older than 60 days",
    },
  },
});
