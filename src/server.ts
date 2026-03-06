import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

import { getJobHandlers, getJobOptions } from "@/config/dynamic-registry.ts";
import { getEnv } from "@/config/env.ts";
import { loadConfig } from "@/config/load-config.ts";
import { pool } from "@/db/index.ts";
import { isDirectExecution } from "@/jobs/_shared/is-direct-execution.ts";
import { createDashboardApi } from "@/src/dashboard/api.ts";
import { authMiddleware } from "@/src/middleware/auth.ts";
import { createJobsRouter } from "@/src/routes/jobs.ts";
import { jobsQueue } from "./queue.ts";

const jobHandlers = await getJobHandlers();
const config = await loadConfig();

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
  const opts = getJobOptions(body.jobName, config);
  const job = await jobsQueue.add(body.jobName, jobData, opts);

  return c.json({ jobId: job.id, jobName: job.name });
});

const jobsRouter = createJobsRouter({ jobsQueue, jobHandlers, config });
v1.route("/jobs", jobsRouter);

app.route("/v1", v1);

const dashboardApi = createDashboardApi({ config, jobsQueue, jobHandlers });
app.route("/api/dashboard", dashboardApi);

app.use(
  "/dashboard/*",
  serveStatic({ root: "./dist/client", rewriteRequestPath: (p) => p.replace(/^\/dashboard/, "") }),
);
app.use(
  "/dashboard",
  serveStatic({ root: "./dist/client", rewriteRequestPath: () => "/index.html" }),
);
app.get("/dashboard/*", async (c) => {
  const { default: fs } = await import("node:fs/promises");
  const html = await fs.readFile("./dist/client/index.html", "utf-8");
  return c.html(html);
});

if (isDirectExecution(import.meta.url)) {
  const { port } = getEnv();

  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`
 ██████╗██╗███╗   ██╗███╗   ██╗ █████╗ ███╗   ███╗ ██████╗ ███╗   ██╗
██╔════╝██║████╗  ██║████╗  ██║██╔══██╗████╗ ████║██╔═══██╗████╗  ██║
██║     ██║██╔██╗ ██║██╔██╗ ██║███████║██╔████╔██║██║   ██║██╔██╗ ██║
██║     ██║██║╚██╗██║██║╚██╗██║██╔══██║██║╚██╔╝██║██║   ██║██║╚██╗██║
╚██████╗██║██║ ╚████║██║ ╚████║██║  ██║██║ ╚═╝ ██║╚██████╔╝██║ ╚████║
 ╚═════╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
`);
    console.log(`  Listening on http://localhost:${info.port}`);
    console.log(`  Dashboard  http://localhost:${info.port}/dashboard\n`);
  });

  const shutdown = async () => {
    await jobsQueue.close();
    await pool.end();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
