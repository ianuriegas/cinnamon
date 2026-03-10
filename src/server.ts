import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { getJobHandlers, getJobOptions } from "@/config/dynamic-registry.ts";
import { getEnv, isDashboardAuthEnabled } from "@/config/env.ts";
import { loadConfig } from "@/config/load-config.ts";
import { db, pool } from "@/db/index.ts";
import { jobTeams } from "@/db/schema/job-teams.ts";
import { isDirectExecution } from "@/jobs/_shared/is-direct-execution.ts";
import { csrfMiddleware } from "@/src/auth/csrf.ts";
import type { SessionPayload } from "@/src/auth/dashboard-auth.ts";
import type { UserTeamEntry } from "@/src/auth/dashboard-middleware.ts";
import { dashboardAuthMiddleware } from "@/src/auth/dashboard-middleware.ts";
import { createAuthRoutes } from "@/src/auth/routes.ts";
import { createAdminApi } from "@/src/dashboard/admin-api.ts";
import { createDashboardApi } from "@/src/dashboard/api.ts";
import { authMiddleware } from "@/src/middleware/auth.ts";
import { syncJobTeams } from "@/src/rbac/sync-job-teams.ts";
import { createJobsRouter } from "@/src/routes/jobs.ts";
import { jobsQueue } from "./queue.ts";

const jobHandlers = await getJobHandlers();
const config = await loadConfig();

try {
  await syncJobTeams(config);
} catch (err) {
  console.warn("RBAC: could not sync job teams —", (err as Error).message);
}

type AppEnv = {
  Variables: {
    teamIds?: number[];
    session?: SessionPayload;
    userTeams?: UserTeamEntry[];
    isSuperAdmin?: boolean;
  };
};

export const app = new Hono<AppEnv>();

app.use("*", secureHeaders());

app.get("/health", (c) => c.json({ status: "ok" }));

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

  const teamIds = c.get("teamIds") ?? [];
  if (teamIds.length === 0) {
    return c.json({ error: "Invalid or revoked API key" }, 401);
  }
  const allowedTeams = await db
    .select({ teamId: jobTeams.teamId })
    .from(jobTeams)
    .where(eq(jobTeams.jobName, body.jobName));
  const allowedTeamIds = new Set(allowedTeams.map((r) => r.teamId));

  if (allowedTeamIds.size === 0) {
    return c.json(
      { error: "Job is not assigned to any team; only super-admins can trigger it" },
      403,
    );
  }
  const matchedTeamId = teamIds.find((id) => allowedTeamIds.has(id));
  if (matchedTeamId == null) {
    return c.json({ error: "Your team does not have permission to trigger this job" }, 403);
  }

  const jobData = { ...body.data, teamId: matchedTeamId };
  const opts = getJobOptions(body.jobName, config);
  const job = await jobsQueue.add(body.jobName, jobData, opts);

  return c.json({ jobId: job.id, jobName: job.name });
});

const jobsRouter = createJobsRouter({ jobsQueue, jobHandlers, config });
v1.route("/jobs", jobsRouter);

app.route("/v1", v1);

// --- Dashboard API (auth + CSRF protected) ---
app.use("/api/dashboard/*", dashboardAuthMiddleware);
app.use("/api/dashboard/*", csrfMiddleware);

const dashboardApi = createDashboardApi({ config, jobsQueue, jobHandlers });
app.route("/api/dashboard", dashboardApi);

// --- Admin API (auth + CSRF + super-admin only) ---
app.use("/api/admin/*", dashboardAuthMiddleware);
app.use("/api/admin/*", csrfMiddleware);
const adminApi = createAdminApi();
app.route("/api/admin", adminApi);

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
