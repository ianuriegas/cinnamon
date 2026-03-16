import { defineConfig } from "./config/define-config.ts";

export default defineConfig({
  jobs: {
    "hello-world": {
      command: "uv",
      args: ["run", "--project", "./jobs/hello-world", "./jobs/hello-world/hello.py"],
      timeout: "30s",
      description: "Demo Python script",
    },
  },
});
