import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import type { CinnamonConfig } from "@/config/define-config.ts";
import { isDashboardAuthEnabled } from "@/config/env.ts";
import { CHANNEL_PREFIX, createRedisSubscriber, getRedisPublisher } from "@/config/redis-pubsub.ts";
import { db } from "@/db/index.ts";
import { jobTeams } from "@/db/schema/job-teams.ts";
import { jobsLog } from "@/db/schema/jobs-log.ts";
import type { UserTeamEntry } from "@/src/auth/dashboard-middleware.ts";
import {
  highestRole,
  Permission,
  roleHasPermission,
  type TeamRoleValue,
} from "@/src/auth/permissions.ts";
import { requirePermission } from "@/src/auth/require-permission.ts";
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

function isSuperAdmin(c: Context): boolean {
  return (c.get("isSuperAdmin") as boolean | undefined) ?? false;
}

function getUserTeams(c: Context): UserTeamEntry[] {
  return (c.get("userTeams") as UserTeamEntry[] | undefined) ?? [];
}

/**
 * Returns the set of job names visible to the current user based on their team memberships.
 * Returns `null` when no filtering is needed (auth disabled or super-admin).
 */
async function getVisibleJobNames(c: Context): Promise<Set<string> | null> {
  if (!isDashboardAuthEnabled() || isSuperAdmin(c)) return null;
  const teamIds = getUserTeams(c).map((t) => t.teamId);
  if (teamIds.length === 0) return new Set();
  const rows = await db
    .select({ jobName: jobTeams.jobName })
    .from(jobTeams)
    .where(inArray(jobTeams.teamId, teamIds));
  return new Set(rows.map((r) => r.jobName));
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
    const visible = await getVisibleJobNames(c);

    if (visible !== null && visible.size === 0) {
      return c.json({
        data: [],
        pagination: { total: 0, limit: limitParam, offset: offsetParam },
        jobNames: [],
      });
    }

    const rbacCondition = visible ? inArray(jobsLog.jobName, [...visible]) : undefined;
    const combinedWhere = rbacCondition
      ? where
        ? and(where, rbacCondition)
        : rbacCondition
      : where;

    const [{ rows, total }, jobNameRows] = await Promise.all([
      fetchRuns(combinedWhere, limitParam, offsetParam),
      db
        .selectDistinct({ jobName: jobsLog.jobName })
        .from(jobsLog)
        .where(rbacCondition)
        .orderBy(jobsLog.jobName),
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

  async function checkRunVisibility(c: Context, jobName: string): Promise<boolean> {
    const visible = await getVisibleJobNames(c);
    return visible === null || visible.has(jobName);
  }

  router.get("/runs/:id", async (c) => {
    const row = await findRunByParam(c.req.param("id"));
    if (!row) return c.json({ error: "Run not found" }, 404);
    if (!(await checkRunVisibility(c, row.jobName))) return c.json({ error: "Run not found" }, 404);
    return c.json({ data: row });
  });

  router.get("/runs/:id/raw", async (c) => {
    const row = await findRunByParam(c.req.param("id"));
    if (!row) return c.text("Run not found", 404);
    if (!(await checkRunVisibility(c, row.jobName))) return c.text("Run not found", 404);

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
    if (!(await checkRunVisibility(c, row.jobName))) return c.json({ error: "Run not found" }, 404);

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

      sub.subscribe(channel);

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
    if (!(await checkRunVisibility(c, row.jobName))) return c.json({ error: "Run not found" }, 404);

    if (isDashboardAuthEnabled() && !isSuperAdmin(c)) {
      const userTeamList = getUserTeams(c);
      const jobTeamRows = await db
        .select({ teamId: jobTeams.teamId })
        .from(jobTeams)
        .where(eq(jobTeams.jobName, row.jobName));
      const jobTeamIds = new Set(jobTeamRows.map((r) => r.teamId));
      // Also include the run's team — it was authorized at enqueue time; config may have changed since
      if (row.teamId != null) jobTeamIds.add(row.teamId);
      const matchingRoles = userTeamList
        .filter((t) => jobTeamIds.has(t.teamId))
        .map((t) => t.role as TeamRoleValue);
      const best = highestRole(matchingRoles);
      if (!best || !roleHasPermission(best, Permission.RUNS_CANCEL)) {
        return c.json({ error: "Forbidden" }, 403);
      }
    }

    if (row.status === JOB_STATUS.queued) {
      try {
        const bullJob = await jobsQueue.getJob(row.jobId);
        if (bullJob) {
          await bullJob.remove();
        }
      } catch {
        // Job may have already been picked up
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
    const visible = await getVisibleJobNames(c);

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

    const definitions = Object.entries(config.jobs)
      .filter(([name]) => visible === null || visible.has(name))
      .map(([name, def]) => ({
        name,
        command: def.command,
        script: def.script,
        schedule: def.schedule,
        timeout: def.timeout,
        retries: def.retries,
        description: def.description,
        teams: def.teams ?? [],
        lastRun: lastRunMap.get(name) ?? null,
      }));

    return c.json({ data: definitions });
  });

  router.get("/schedules", async (c) => {
    const visible = await getVisibleJobNames(c);

    let schedulers: Array<{ name: string; pattern: string; next: number | null }> = [];
    try {
      const raw = await jobsQueue.getJobSchedulers(0, -1);
      schedulers = raw
        .filter((s): s is typeof s & { pattern: string } => typeof s.pattern === "string")
        .map((s) => ({ name: s.name, pattern: s.pattern, next: s.next ?? null }));
    } catch {
      schedulers = [];
    }

    if (visible !== null) {
      schedulers = schedulers.filter((s) => visible.has(s.name));
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

  router.post(
    "/trigger/:name",
    requirePermission(Permission.RUNS_TRIGGER, (c) => c.req.param("name") ?? null),
    async (c) => {
      const name = c.req.param("name") as string;

      if (!(name in jobHandlers)) {
        return c.json({ error: `Unknown job: ${name}` }, 400);
      }

      let matchedTeamId: number | null = null;
      if (isDashboardAuthEnabled() && !isSuperAdmin(c)) {
        const userTeamList = getUserTeams(c);
        const jobTeamRows = await db
          .select({ teamId: jobTeams.teamId })
          .from(jobTeams)
          .where(eq(jobTeams.jobName, name));
        const jobTeamIds = new Set(jobTeamRows.map((r) => r.teamId));
        const match = userTeamList.find((t) => jobTeamIds.has(t.teamId));
        matchedTeamId = match?.teamId ?? null;
      }

      try {
        const job = await jobsQueue.add(name, { teamId: matchedTeamId });
        const jobId = String(job.id);

        await db
          .insert(jobsLog)
          .values({
            jobId,
            queueName: job.queueName,
            jobName: name,
            teamId: matchedTeamId,
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
    },
  );

  return router;
}
