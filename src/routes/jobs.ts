import type { Queue } from "bullmq";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { Hono } from "hono";

import type { CinnamonConfig } from "@/config/define-config.ts";
import { getJobOptions } from "@/config/dynamic-registry.ts";
import { db } from "@/db/index.ts";
import { jobsLog } from "@/db/schema/jobs-log.ts";
import type { JobHandler } from "@/src/job-types.ts";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
const TRUNCATE_LENGTH = 200;

type AppEnv = {
  Variables: {
    teamId: number;
  };
};

interface JobsRouterDeps {
  jobsQueue: Queue;
  jobHandlers: Record<string, JobHandler>;
  config: CinnamonConfig;
}

function truncateJson(value: unknown): unknown {
  if (value == null) return null;
  const str = JSON.stringify(value);
  if (str.length <= TRUNCATE_LENGTH) return value;
  return `${str.slice(0, TRUNCATE_LENGTH)}...`;
}

export function createJobsRouter({ jobsQueue, jobHandlers, config }: JobsRouterDeps) {
  const router = new Hono<AppEnv>();

  router.get("/definitions", async (c) => {
    const definitions = Object.entries(config.jobs).map(([name, def]) => ({
      name,
      command: def.command,
      script: def.script,
      schedule: def.schedule,
      timeout: def.timeout,
      retries: def.retries,
      description: def.description,
    }));
    return c.json({ data: definitions });
  });

  router.get("/schedules", async (c) => {
    try {
      const schedulers = await jobsQueue.getJobSchedulers(0, -1);
      const data = schedulers.map((s) => ({
        name: s.name,
        pattern: s.pattern,
        next: s.next ? new Date(s.next).toISOString() : null,
      }));
      return c.json({ data });
    } catch {
      return c.json({ error: "Failed to fetch job schedules" }, 503);
    }
  });

  router.get("/:id", async (c) => {
    const idParam = c.req.param("id");
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) {
      return c.json({ error: "Invalid job ID" }, 400);
    }

    const teamId = c.get("teamId");
    const [row] = await db
      .select()
      .from(jobsLog)
      .where(and(eq(jobsLog.id, id), eq(jobsLog.teamId, teamId)))
      .limit(1);

    if (!row) {
      return c.json({ error: "Job not found" }, 404);
    }

    return c.json({ data: row });
  });

  router.get("/", async (c) => {
    const teamId = c.get("teamId");
    const limitParam = Math.min(Number(c.req.query("limit")) || DEFAULT_LIMIT, MAX_LIMIT);
    const offsetParam = Math.max(Number(c.req.query("offset")) || 0, 0);
    const nameFilter = c.req.query("name");
    const statusFilter = c.req.query("status");
    const sinceFilter = c.req.query("since");

    const conditions = [eq(jobsLog.teamId, teamId)];

    if (nameFilter) {
      conditions.push(eq(jobsLog.jobName, nameFilter));
    }
    if (statusFilter) {
      conditions.push(eq(jobsLog.status, statusFilter));
    }
    if (sinceFilter) {
      const sinceDate = new Date(sinceFilter);
      if (!Number.isNaN(sinceDate.getTime())) {
        conditions.push(gte(jobsLog.createdAt, sinceDate));
      }
    }

    const where = and(...conditions);

    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(jobsLog)
        .where(where)
        .orderBy(desc(jobsLog.createdAt))
        .limit(limitParam)
        .offset(offsetParam),
      db.select({ total: count() }).from(jobsLog).where(where),
    ]);

    const data = rows.map((row) => ({
      ...row,
      payload: truncateJson(row.payload),
      result: truncateJson(row.result),
    }));

    return c.json({
      data,
      pagination: {
        limit: limitParam,
        offset: offsetParam,
        total: totalRow.total,
      },
    });
  });

  router.post("/:name/trigger", async (c) => {
    const name = c.req.param("name");

    if (!(name in jobHandlers)) {
      return c.json({ error: `Unknown job: ${name}` }, 400);
    }

    let data: Record<string, unknown> = {};
    try {
      const body = await c.req.json();
      if (body?.data && typeof body.data === "object") {
        data = body.data;
      }
    } catch {
      // No body or invalid JSON is fine — trigger with empty data
    }

    const teamId = c.get("teamId");
    const jobData = { ...data, teamId };
    const opts = getJobOptions(name, config);

    try {
      const job = await jobsQueue.add(name, jobData, opts);
      return c.json({ jobId: job.id, jobName: job.name });
    } catch {
      return c.json({ error: "Failed to enqueue job" }, 503);
    }
  });

  return router;
}
