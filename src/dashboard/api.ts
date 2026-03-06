import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import type { CinnamonConfig } from "@/config/define-config.ts";
import { CHANNEL_PREFIX, createRedisSubscriber, getRedisPublisher } from "@/config/redis-pubsub.ts";
import { db } from "@/db/index.ts";
import { jobsLog } from "@/db/schema/jobs-log.ts";
import { JOB_STATUS } from "@/src/job-types.ts";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

interface DashboardApiDeps {
  config: CinnamonConfig;
  jobsQueue: import("bullmq").Queue;
  jobHandlers: Record<string, unknown>;
}

function isShellResult(
  value: unknown,
): value is { stdout?: string; stderr?: string; exitCode?: number; parsed?: unknown } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return "stdout" in v || "stderr" in v || "exitCode" in v;
}

function formatJson(value: unknown): string {
  if (value == null) return "null";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function createDashboardApi({ config, jobsQueue, jobHandlers }: DashboardApiDeps) {
  const router = new Hono();

  function parseRunsQuery(c: { req: { query(k: string): string | undefined } }) {
    const limitParam = Math.min(Number(c.req.query("limit")) || DEFAULT_LIMIT, MAX_LIMIT);
    const offsetParam = Math.max(Number(c.req.query("offset")) || 0, 0);
    const nameFilter = c.req.query("name") ?? "";
    const statusFilter = c.req.query("status") ?? "";
    const sinceFilter = c.req.query("since") ?? "";

    const conditions = [];
    if (nameFilter) conditions.push(eq(jobsLog.jobName, nameFilter));
    if (statusFilter) conditions.push(eq(jobsLog.status, statusFilter));
    if (sinceFilter) {
      const sinceDate = new Date(sinceFilter);
      if (!Number.isNaN(sinceDate.getTime())) {
        conditions.push(gte(jobsLog.createdAt, sinceDate));
      }
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return { limitParam, offsetParam, nameFilter, statusFilter, sinceFilter, where };
  }

  async function fetchRuns(
    where: ReturnType<typeof parseRunsQuery>["where"],
    limit: number,
    offset: number,
  ) {
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(jobsLog)
        .where(where)
        .orderBy(desc(jobsLog.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(jobsLog).where(where),
    ]);
    return { rows, total: totalRow.total };
  }

  router.get("/runs", async (c) => {
    const { limitParam, offsetParam, where } = parseRunsQuery(c);

    const [{ rows, total }, jobNameRows] = await Promise.all([
      fetchRuns(where, limitParam, offsetParam),
      db.selectDistinct({ jobName: jobsLog.jobName }).from(jobsLog).orderBy(jobsLog.jobName),
    ]);

    return c.json({
      data: rows,
      pagination: { total, limit: limitParam, offset: offsetParam },
      jobNames: jobNameRows.map((r) => r.jobName),
    });
  });

  async function findRunByParam(idParam: string) {
    let [row] = await db.select().from(jobsLog).where(eq(jobsLog.jobId, idParam)).limit(1);

    if (!row) {
      const numericId = Number(idParam);
      if (Number.isInteger(numericId) && numericId > 0) {
        [row] = await db.select().from(jobsLog).where(eq(jobsLog.id, numericId)).limit(1);
      }
    }

    return row ?? null;
  }

  router.get("/runs/:id", async (c) => {
    const row = await findRunByParam(c.req.param("id"));
    if (!row) return c.json({ error: "Run not found" }, 404);
    return c.json({ data: row });
  });

  router.get("/runs/:id/raw", async (c) => {
    const row = await findRunByParam(c.req.param("id"));
    if (!row) return c.text("Run not found", 404);

    const parts: string[] = [];
    if (row.logs) parts.push(row.logs);

    const shell = isShellResult(row.result) ? row.result : null;
    if (shell) {
      if (shell.stdout?.trim()) parts.push(`--- stdout ---\n${shell.stdout.trimEnd()}`);
      if (shell.stderr?.trim()) parts.push(`--- stderr ---\n${shell.stderr.trimEnd()}`);
      if (shell.parsed) parts.push(`--- parsed result ---\n${formatJson(shell.parsed)}`);
    } else if (row.result != null) {
      parts.push(`--- result ---\n${formatJson(row.result)}`);
    }

    return c.text(parts.length > 0 ? parts.join("\n\n") : "No output for this run.");
  });

  router.get("/runs/:id/stream", async (c) => {
    const row = await findRunByParam(c.req.param("id"));
    if (!row) return c.json({ error: "Run not found" }, 404);

    const isTerminal =
      row.status === JOB_STATUS.completed ||
      row.status === JOB_STATUS.failed ||
      row.status === JOB_STATUS.cancelled;

    if (isTerminal) {
      return streamSSE(c, async (stream) => {
        if (row.logs) {
          await stream.writeSSE({
            event: "log",
            data: JSON.stringify({ type: "log", text: row.logs }),
          });
        }
        const shell = isShellResult(row.result) ? row.result : null;
        if (shell?.stdout) {
          await stream.writeSSE({
            event: "chunk",
            data: JSON.stringify({ type: "chunk", stream: "stdout", text: shell.stdout }),
          });
        }
        if (shell?.stderr) {
          await stream.writeSSE({
            event: "chunk",
            data: JSON.stringify({ type: "chunk", stream: "stderr", text: shell.stderr }),
          });
        }
        await stream.writeSSE({
          event: "done",
          data: JSON.stringify({ type: "done", status: row.status }),
        });
      });
    }

    return streamSSE(c, async (stream) => {
      const sub = createRedisSubscriber();
      const channel = `${CHANNEL_PREFIX.logs}${row.jobId}`;
      const bufKey = `${CHANNEL_PREFIX.logbuf}${row.jobId}`;

      let done = false;

      // Subscribe first so messages queue in ioredis while we replay
      sub.subscribe(channel);

      // Replay buffered history from the Redis list
      const buffered = await getRedisPublisher().lrange(bufKey, 0, -1);
      const replayed = new Set<string>();
      for (const msg of buffered) {
        if (done) break;
        replayed.add(msg);
        try {
          const parsed = JSON.parse(msg);
          const event = parsed.type === "done" ? "done" : parsed.type === "log" ? "log" : "chunk";
          await stream.writeSSE({ event, data: msg });
          if (parsed.type === "done") {
            done = true;
          }
        } catch {
          // ignore parse errors
        }
      }

      if (done) {
        await sub.unsubscribe(channel);
        await sub.quit();
      } else {
        sub.on("message", async (_ch: string, message: string) => {
          if (done) return;
          // Deduplicate: skip messages we already sent during replay
          if (replayed.delete(message)) return;
          try {
            const parsed = JSON.parse(message);
            const event = parsed.type === "done" ? "done" : parsed.type === "log" ? "log" : "chunk";
            await stream.writeSSE({ event, data: message });
            if (parsed.type === "done") {
              done = true;
              await sub.unsubscribe(channel);
              await sub.quit();
            }
          } catch {
            // ignore parse errors
          }
        });
      }

      stream.onAbort(() => {
        done = true;
        sub.unsubscribe(channel).catch(() => {});
        sub.quit().catch(() => {});
      });

      while (!done) {
        await stream.sleep(1000);
      }
    });
  });

  router.post("/runs/:id/cancel", async (c) => {
    const row = await findRunByParam(c.req.param("id"));
    if (!row) return c.json({ error: "Run not found" }, 404);

    if (row.status === JOB_STATUS.queued) {
      try {
        const bullJob = await jobsQueue.getJob(row.jobId);
        if (bullJob) {
          await bullJob.remove();
        }
      } catch {
        // Job may have already been picked up — that's fine
      }

      await db
        .update(jobsLog)
        .set({
          status: JOB_STATUS.cancelled,
          error: false,
          result: { message: "Job cancelled while queued" },
          finishedAt: new Date(),
        })
        .where(eq(jobsLog.jobId, row.jobId));

      return c.json({ status: "cancelled" });
    }

    if (row.status === JOB_STATUS.processing) {
      getRedisPublisher().publish(`${CHANNEL_PREFIX.cancel}${row.jobId}`, "cancel");
      return c.json({ status: "cancelling" });
    }

    return c.json({ error: `Cannot cancel job with status '${row.status}'` }, 400);
  });

  router.get("/definitions", async (c) => {
    const lastRunSubquery = db
      .select({
        jobName: jobsLog.jobName,
        status: jobsLog.status,
        createdAt: jobsLog.createdAt,
        rn: sql<number>`row_number() over (partition by ${jobsLog.jobName} order by ${jobsLog.createdAt} desc)`.as(
          "rn",
        ),
      })
      .from(jobsLog)
      .as("last_runs");

    const lastRuns = await db
      .select({
        jobName: lastRunSubquery.jobName,
        status: lastRunSubquery.status,
        createdAt: lastRunSubquery.createdAt,
      })
      .from(lastRunSubquery)
      .where(eq(lastRunSubquery.rn, 1));

    const lastRunMap = new Map(lastRuns.map((r) => [r.jobName, r]));

    const definitions = Object.entries(config.jobs).map(([name, def]) => ({
      name,
      command: def.command,
      script: def.script,
      schedule: def.schedule,
      timeout: def.timeout,
      retries: def.retries,
      description: def.description,
      lastRun: lastRunMap.get(name) ?? null,
    }));

    return c.json({ data: definitions });
  });

  router.get("/schedules", async (c) => {
    let schedulers: Array<{ name: string; pattern: string; next: number | null }> = [];
    try {
      const raw = await jobsQueue.getJobSchedulers(0, -1);
      schedulers = raw
        .filter((s): s is typeof s & { pattern: string } => typeof s.pattern === "string")
        .map((s) => ({ name: s.name, pattern: s.pattern, next: s.next ?? null }));
    } catch {
      schedulers = [];
    }

    const scheduledJobNames = schedulers.map((s) => s.name);
    let statsMap = new Map<string, { total: number; completed: number; failed: number }>();

    if (scheduledJobNames.length > 0) {
      const statsRows = await db
        .select({
          jobName: jobsLog.jobName,
          total: count(),
          completed: sql<number>`count(*) filter (where ${jobsLog.status} = 'completed')`.mapWith(
            Number,
          ),
          failed: sql<number>`count(*) filter (where ${jobsLog.status} = 'failed')`.mapWith(Number),
        })
        .from(jobsLog)
        .where(sql`${jobsLog.jobName} in ${scheduledJobNames}`)
        .groupBy(jobsLog.jobName);

      statsMap = new Map(statsRows.map((r) => [r.jobName, r]));
    }

    const schedules = schedulers.map((s) => ({
      name: s.name,
      pattern: s.pattern,
      next: s.next ? new Date(s.next).toISOString() : null,
      stats: statsMap.get(s.name) ?? { total: 0, completed: 0, failed: 0 },
    }));

    return c.json({ data: schedules });
  });

  router.post("/trigger/:name", async (c) => {
    const name = c.req.param("name");

    if (!(name in jobHandlers)) {
      return c.json({ error: `Unknown job: ${name}` }, 400);
    }

    try {
      const job = await jobsQueue.add(name, {});
      const jobId = String(job.id);

      await db
        .insert(jobsLog)
        .values({
          jobId,
          queueName: job.queueName,
          jobName: name,
          status: JOB_STATUS.queued,
          payload: {},
          error: false,
        })
        .onConflictDoNothing({ target: jobsLog.jobId });

      return c.json({ jobId, jobName: name });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to enqueue";
      return c.json({ error: msg }, 500);
    }
  });

  return router;
}
