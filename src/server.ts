import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import figlet from "figlet";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";

import { getJobHandlers, getJobOptions } from "@/config/dynamic-registry.ts";
import { getEnv, isDashboardAuthEnabled } from "@/config/env.ts";
import { loadConfig } from "@/config/load-config.ts";
import { getRedisPublisher } from "@/config/redis-pubsub.ts";
import { resolveTeams } from "@/config/resolve-teams.ts";
import { pool } from "@/db/index.ts";
import { isDirectExecution } from "@/jobs/_shared/is-direct-execution.ts";
import { csrfMiddleware } from "@/src/auth/csrf.ts";
import { dashboardAuthMiddleware } from "@/src/auth/dashboard-middleware.ts";
import { createAuthRoutes } from "@/src/auth/routes.ts";
import { superAdminMiddleware } from "@/src/auth/super-admin-middleware.ts";
import { createDashboardApi } from "@/src/dashboard/api.ts";
import { authMiddleware } from "@/src/middleware/auth.ts";
import { createJobsRouter } from "@/src/routes/jobs.ts";
import { jobsQueue } from "./queue.ts";

const jobHandlers = await getJobHandlers();
const config = await loadConfig();
const { jobTeamIds } = await resolveTeams(config);

type AppEnv = {
  Variables: {
    teamId: number;
  };
};

export const app = new Hono<AppEnv>();

app.use("*", secureHeaders());

app.get("/health", async (c) => {
  const checks: Record<string, string> = {};

  try {
    await pool.query("SELECT 1");
    checks.postgres = "ok";
  } catch {
    checks.postgres = "unreachable";
  }

  try {
    const redis = getRedisPublisher();
    await redis.ping();
    checks.redis = "ok";
  } catch {
    checks.redis = "unreachable";
  }

  const healthy = checks.postgres === "ok" && checks.redis === "ok";
  return c.json({ status: healthy ? "ok" : "degraded", checks }, healthy ? 200 : 503);
});

// --- Auth routes (before dashboard) ---
const authRoutes = createAuthRoutes();
app.route("/auth", authRoutes);

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

  const allowedTeams = jobTeamIds.get(body.jobName);
  if (allowedTeams && !allowedTeams.includes(teamId)) {
    return c.json({ error: `Unknown job: ${body.jobName}` }, 400);
  }
  const jobData = { ...body.data, teamId };
  const opts = getJobOptions(body.jobName, config);
  const job = await jobsQueue.add(body.jobName, jobData, opts);

  return c.json({ jobId: job.id, jobName: job.name });
});

const jobsRouter = createJobsRouter({ jobsQueue, jobHandlers, config, jobTeamIds });
v1.route("/jobs", jobsRouter);

app.route("/v1", v1);

// --- Dashboard API (auth + CSRF protected) ---
app.use("/api/dashboard/*", dashboardAuthMiddleware);
app.use("/api/dashboard/*", csrfMiddleware);

// Admin-only routes require super-admin
app.use("/api/dashboard/users/*", superAdminMiddleware);
app.use("/api/dashboard/teams/*", superAdminMiddleware);
app.use("/api/dashboard/api-keys/*", superAdminMiddleware);
// Only approve/deny require super-admin; /access-requests/mine and POST do not.
app.use("/api/dashboard/access-requests/:id/approve", superAdminMiddleware);
app.use("/api/dashboard/access-requests/:id/deny", superAdminMiddleware);
// GET /access-requests (list all) requires super-admin.
app.use("/api/dashboard/access-requests", async (c, next) => {
  if (c.req.method === "GET" && c.req.path === "/api/dashboard/access-requests") {
    return superAdminMiddleware(c, next);
  }
  return next();
});

const dashboardApi = createDashboardApi({ config, jobsQueue, jobHandlers, jobTeamIds });
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
    console.log(figlet.textSync("Cinnamon", { font: "ANSI Shadow" }));
    console.log(`  Listening on http://localhost:${info.port}`);
    console.log(`  Dashboard  http://localhost:${info.port}/dashboard`);
    console.log(
      `  Auth       ${isDashboardAuthEnabled() ? "Google OAuth enabled" : "disabled (no GOOGLE_CLIENT_ID)"}\n`,
    );
  });

  const shutdown = async () => {
    await jobsQueue.close();
    await pool.end();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
