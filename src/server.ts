import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { getEnv } from "@/config/env.ts";
import { pool } from "@/db/index.ts";
import { isDirectExecution } from "@/jobs/_shared/is-direct-execution.ts";
import { jobHandlers } from "@/jobs/registry.ts";
import { authMiddleware } from "@/src/middleware/auth.ts";
import { jobsQueue } from "./queue.ts";

type AppEnv = {
  Variables: {
    teamId: number;
  };
};

export const app = new Hono<AppEnv>();

app.get("/health", (c) => c.json({ status: "ok" }));

const v1 = new Hono<AppEnv>();
v1.use("*", authMiddleware);

v1.post("/enqueue", async (c) => {
  const body = await c.req.json<{ jobName?: string; data?: Record<string, unknown> }>();

  if (!body.jobName || typeof body.jobName !== "string") {
    return c.json({ error: "jobName is required and must be a string" }, 400);
  }

  if (!(body.jobName in jobHandlers)) {
    return c.json({ error: `Unknown job: ${body.jobName}` }, 400);
  }

  const teamId = c.get("teamId");
  const jobData = { ...body.data, teamId };
  const job = await jobsQueue.add(body.jobName, jobData);

  return c.json({ jobId: job.id, jobName: job.name });
});

app.route("/v1", v1);

if (isDirectExecution(import.meta.url)) {
  const { port } = getEnv();

  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Cinnamon API listening on http://localhost:${info.port}`);
  });

  const shutdown = async () => {
    await jobsQueue.close();
    await pool.end();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
