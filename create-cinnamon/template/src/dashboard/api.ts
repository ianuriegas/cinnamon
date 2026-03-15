import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import type { CinnamonConfig } from "@/config/define-config.ts";
import { isAccessRequestsEnabled } from "@/config/env.ts";
import { CHANNEL_PREFIX, createRedisSubscriber, getRedisPublisher } from "@/config/redis-pubsub.ts";
import { db } from "@/db/index.ts";
import { accessRequests } from "@/db/schema/access-requests.ts";
import { apiKeys } from "@/db/schema/api-keys.ts";
import { jobsLog } from "@/db/schema/jobs-log.ts";
import { teams } from "@/db/schema/teams.ts";
import { userTeams } from "@/db/schema/user-teams.ts";
import { users } from "@/db/schema/users.ts";
import { JOB_STATUS } from "@/src/job-types.ts";
import { generateApiKey } from "@/src/lib/api-key-utils.ts";
import { isJobVisibleToAnyTeam } from "@/src/lib/team-utils.ts";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

interface DashboardApiDeps {
  config: CinnamonConfig;
  jobsQueue: import("bullmq").Queue;
  jobHandlers: Record<string, unknown>;
  jobTeamIds: Map<string, number[]>;
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

type DashboardUser = {
  id: number;
  email: string;
  googleSub?: string;
  name: string | null;
  picture: string | null;
  isSuperAdmin: boolean;
  disabled: boolean;
};

type DashboardEnv = {
  Variables: {
    user: DashboardUser;
    userTeamIds: number[];
  };
};

export function createDashboardApi({
  config,
  jobsQueue,
  jobHandlers,
  jobTeamIds,
}: DashboardApiDeps) {
  const router = new Hono<DashboardEnv>();

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
    return { limitParam, offsetParam, nameFilter, statusFilter, sinceFilter, conditions };
  }

  function buildRunsWhere(
    conditions: ReturnType<typeof parseRunsQuery>["conditions"],
    user: DashboardUser,
    userTeamIds: number[],
  ) {
    const all = [...conditions];
    if (!user.isSuperAdmin) {
      if (userTeamIds.length === 0) {
        all.push(sql`1 = 0`); // No teams: return no rows (Phase 6 middleware blocks before this)
      } else {
        all.push(inArray(jobsLog.teamId, userTeamIds));
      }
    }
    return all.length > 0 ? and(...all) : undefined;
  }

  function canAccessRun(
    row: { teamId: number | null },
    user: DashboardUser,
    userTeamIds: number[],
  ): boolean {
    if (user.isSuperAdmin) return true;
    if (row.teamId == null) return false;
    return userTeamIds.includes(row.teamId);
  }

  async function fetchRuns(
    where: ReturnType<typeof buildRunsWhere>,
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
    const user = c.get("user");
    const userTeamIds = c.get("userTeamIds");
    const { limitParam, offsetParam, conditions } = parseRunsQuery(c);
    const where = buildRunsWhere(conditions, user, userTeamIds);

    const [{ rows, total }, jobNameRows] = await Promise.all([
      fetchRuns(where, limitParam, offsetParam),
      db
        .selectDistinct({ jobName: jobsLog.jobName })
        .from(jobsLog)
        .where(where ?? sql`true`)
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

  router.get("/runs/:id", async (c) => {
    const row = await findRunByParam(c.req.param("id"));
    if (!row) return c.json({ error: "Run not found" }, 404);
    if (!canAccessRun(row, c.get("user"), c.get("userTeamIds"))) {
      return c.json({ error: "Run not found" }, 404);
    }
    return c.json({ data: row });
  });

  router.get("/runs/:id/raw", async (c) => {
    const row = await findRunByParam(c.req.param("id"));
    if (!row) return c.text("Run not found", 404);
    if (!canAccessRun(row, c.get("user"), c.get("userTeamIds"))) {
      return c.text("Run not found", 404);
    }

    const parts: string[] = [];
    if (row.logs) parts.push(row.logs);

    const shell = isShellResult(row.result) ? row.result : null;
    if (shell?.parsed) {
      parts.push(`--- parsed result ---\n${formatJson(shell.parsed)}`);
    } else if (!shell && row.result != null) {
      parts.push(`--- result ---\n${formatJson(row.result)}`);
    }

    return c.text(parts.length > 0 ? parts.join("\n\n") : "No output for this run.");
  });

  router.get("/runs/:id/stream", async (c) => {
    const row = await findRunByParam(c.req.param("id"));
    if (!row) return c.json({ error: "Run not found" }, 404);
    if (!canAccessRun(row, c.get("user"), c.get("userTeamIds"))) {
      return c.json({ error: "Run not found" }, 404);
    }

    const isTerminal =
      row.status === JOB_STATUS.completed ||
      row.status === JOB_STATUS.failed ||
      row.status === JOB_STATUS.cancelled ||
      row.status === JOB_STATUS.interrupted;

    if (isTerminal) {
      return streamSSE(c, async (stream) => {
        if (row.logs) {
          await stream.writeSSE({
            event: "log",
            data: JSON.stringify({ type: "log", text: row.logs }),
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
    if (!canAccessRun(row, c.get("user"), c.get("userTeamIds"))) {
      return c.json({ error: "Run not found" }, 404);
    }

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

  const RETRYABLE_STATUSES = [
    JOB_STATUS.failed,
    JOB_STATUS.cancelled,
    JOB_STATUS.interrupted,
  ] as const;

  router.post("/runs/:id/retry", async (c) => {
    const row = await findRunByParam(c.req.param("id"));
    if (!row) return c.json({ error: "Run not found" }, 404);
    if (!canAccessRun(row, c.get("user"), c.get("userTeamIds"))) {
      return c.json({ error: "Run not found" }, 404);
    }

    if (!RETRYABLE_STATUSES.includes(row.status as (typeof RETRYABLE_STATUSES)[number])) {
      return c.json({ error: `Cannot retry job with status '${row.status}'` }, 400);
    }

    try {
      const bullJob = await jobsQueue.getJob(row.jobId);
      if (!bullJob) {
        return c.json({ error: "Job no longer exists in queue (cannot retry)" }, 404);
      }
      await bullJob.retry();
    } catch (err) {
      console.error(`[dashboard] Retry failed for job ${row.jobId}:`, err);
      return c.json({ error: "Failed to retry job" }, 500);
    }

    // Clear Redis log buffer so live stream gets fresh logs from the retried run
    const bufKey = `${CHANNEL_PREFIX.logbuf}${row.jobId}`;
    await getRedisPublisher().del(bufKey);

    await db
      .update(jobsLog)
      .set({
        status: JOB_STATUS.queued,
        startedAt: null,
        finishedAt: null,
        error: false,
        result: null,
      })
      .where(eq(jobsLog.jobId, row.jobId));

    return c.json({ status: "retrying" });
  });

  router.get("/definitions", async (c) => {
    const user = c.get("user");
    const userTeamIds = c.get("userTeamIds");
    const teamFilter =
      !user.isSuperAdmin && userTeamIds.length > 0
        ? inArray(jobsLog.teamId, userTeamIds)
        : undefined;

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
      .where(teamFilter ?? sql`true`)
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

    let jobEntries = Object.entries(config.jobs);
    if (!user.isSuperAdmin) {
      jobEntries = jobEntries.filter(([name]) =>
        isJobVisibleToAnyTeam(name, userTeamIds, jobTeamIds),
      );
    }

    const definitions = jobEntries.map(([name, def]) => ({
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
    const user = c.get("user");
    const userTeamIds = c.get("userTeamIds");

    let schedulers: Array<{ name: string; pattern: string; next: number | null }> = [];
    try {
      const raw = await jobsQueue.getJobSchedulers(0, -1);
      schedulers = raw
        .filter((s): s is typeof s & { pattern: string } => typeof s.pattern === "string")
        .map((s) => ({ name: s.name, pattern: s.pattern, next: s.next ?? null }));
    } catch {
      schedulers = [];
    }

    if (!user.isSuperAdmin) {
      schedulers = schedulers.filter((s) => isJobVisibleToAnyTeam(s.name, userTeamIds, jobTeamIds));
    }

    const scheduledJobNames = schedulers.map((s) => s.name);
    let statsMap = new Map<string, { total: number; completed: number; failed: number }>();

    if (scheduledJobNames.length > 0) {
      const conditions = [inArray(jobsLog.jobName, scheduledJobNames)];
      if (!user.isSuperAdmin && userTeamIds.length > 0) {
        conditions.push(inArray(jobsLog.teamId, userTeamIds));
      }
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
        .where(and(...conditions))
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
    const user = c.get("user");
    const userTeamIds = c.get("userTeamIds");

    if (!(name in jobHandlers)) {
      return c.json({ error: `Unknown job: ${name}` }, 400);
    }

    if (!user.isSuperAdmin) {
      if (!isJobVisibleToAnyTeam(name, userTeamIds, jobTeamIds)) {
        return c.json({ error: `Unknown job: ${name}` }, 400);
      }
      if (userTeamIds.length === 0) {
        return c.json({ error: "You must be assigned to a team to trigger jobs" }, 403);
      }
    }

    const allowedTeams = jobTeamIds.get(name);
    const teamId =
      user.isSuperAdmin || !allowedTeams
        ? null
        : (userTeamIds.find((tid) => allowedTeams.includes(tid)) ?? userTeamIds[0]);

    try {
      const job = await jobsQueue.add(name, { teamId });
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
          teamId,
        })
        .onConflictDoNothing({ target: jobsLog.jobId });

      return c.json({ jobId, jobName: name });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to enqueue";
      return c.json({ error: msg }, 500);
    }
  });

  // --- Teams management ---

  router.get("/teams", async (c) => {
    const rows = await db
      .select({
        id: teams.id,
        name: teams.name,
        createdAt: teams.createdAt,
      })
      .from(teams)
      .orderBy(desc(teams.createdAt));

    return c.json({ data: rows });
  });

  router.post("/teams", async (c) => {
    const body = await c.req.json<{ name?: string }>();
    const name = body.name?.trim();
    if (!name) return c.json({ error: "Name is required" }, 400);

    const [inserted] = await db
      .insert(teams)
      .values({ name })
      .returning({ id: teams.id, name: teams.name, createdAt: teams.createdAt });

    return c.json({ data: inserted });
  });

  router.patch("/teams/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return c.json({ error: "Invalid team ID" }, 400);
    }

    const body = await c.req.json<{ name: string }>();
    const name = body.name?.trim();
    if (!name) return c.json({ error: "Name is required" }, 400);

    const [updated] = await db
      .update(teams)
      .set({ name })
      .where(eq(teams.id, id))
      .returning({ id: teams.id, name: teams.name, createdAt: teams.createdAt });

    if (!updated) return c.json({ error: "Team not found" }, 404);
    return c.json({ data: updated });
  });

  router.delete("/teams/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return c.json({ error: "Invalid team ID" }, 400);
    }

    const [existing] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.id, id))
      .limit(1);
    if (!existing) return c.json({ error: "Team not found" }, 404);

    await db.transaction(async (tx) => {
      await tx.delete(apiKeys).where(eq(apiKeys.teamId, id));
      await tx.update(jobsLog).set({ teamId: null }).where(eq(jobsLog.teamId, id));
      await tx.delete(teams).where(eq(teams.id, id));
    });

    return c.json({ status: "deleted" });
  });

  // --- API Keys management ---

  router.get("/api-keys", async (c) => {
    const rows = await db
      .select({
        id: apiKeys.id,
        label: apiKeys.label,
        keyHash: apiKeys.keyHash,
        revoked: apiKeys.revoked,
        createdAt: apiKeys.createdAt,
        lastUsedAt: apiKeys.lastUsedAt,
        teamId: apiKeys.teamId,
        teamName: teams.name,
      })
      .from(apiKeys)
      .innerJoin(teams, eq(apiKeys.teamId, teams.id))
      .orderBy(desc(apiKeys.createdAt));

    const data = rows.map((row) => ({
      id: row.id,
      label: row.label,
      keyHint: row.keyHash.slice(-8),
      revoked: row.revoked,
      createdAt: row.createdAt,
      lastUsedAt: row.lastUsedAt,
      teamId: row.teamId,
      teamName: row.teamName,
    }));

    return c.json({ data });
  });

  router.post("/api-keys", async (c) => {
    const body = await c.req.json<{ label?: string; teamId?: number }>();
    const label = body.label?.trim() || null;

    let teamId = body.teamId;
    if (!teamId) {
      const [firstTeam] = await db
        .select({ id: sql<number>`id` })
        .from(sql`cinnamon.teams`)
        .limit(1);
      if (!firstTeam) return c.json({ error: "No team exists" }, 400);
      teamId = firstTeam.id;
    }

    const { plainKey, keyHash } = generateApiKey();
    const [inserted] = await db
      .insert(apiKeys)
      .values({ teamId, keyHash, label })
      .returning({ id: apiKeys.id, createdAt: apiKeys.createdAt });

    return c.json({
      id: inserted.id,
      label,
      plainKey,
      keyHint: keyHash.slice(-8),
      createdAt: inserted.createdAt,
    });
  });

  router.patch("/api-keys/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return c.json({ error: "Invalid key ID" }, 400);
    }

    const body = await c.req.json<{ label: string }>();
    const label = body.label?.trim();
    if (!label) return c.json({ error: "Label is required" }, 400);

    const [updated] = await db
      .update(apiKeys)
      .set({ label })
      .where(eq(apiKeys.id, id))
      .returning({ id: apiKeys.id, label: apiKeys.label });

    if (!updated) return c.json({ error: "API key not found" }, 404);
    return c.json({ data: updated });
  });

  router.post("/api-keys/:id/rotate", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return c.json({ error: "Invalid key ID" }, 400);
    }

    const [existing] = await db
      .select({ teamId: apiKeys.teamId, label: apiKeys.label, revoked: apiKeys.revoked })
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .limit(1);

    if (!existing) return c.json({ error: "API key not found" }, 404);
    if (existing.revoked) return c.json({ error: "Cannot rotate a revoked key" }, 400);

    const { plainKey, keyHash } = generateApiKey();

    await db.update(apiKeys).set({ revoked: true }).where(eq(apiKeys.id, id));

    const [inserted] = await db
      .insert(apiKeys)
      .values({ teamId: existing.teamId, keyHash, label: existing.label })
      .returning({ id: apiKeys.id, createdAt: apiKeys.createdAt });

    return c.json({
      id: inserted.id,
      label: existing.label,
      plainKey,
      keyHint: keyHash.slice(-8),
      createdAt: inserted.createdAt,
      rotatedFromId: id,
    });
  });

  router.post("/api-keys/:id/revoke", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return c.json({ error: "Invalid key ID" }, 400);
    }

    const [updated] = await db
      .update(apiKeys)
      .set({ revoked: true })
      .where(eq(apiKeys.id, id))
      .returning({ id: apiKeys.id });

    if (!updated) return c.json({ error: "API key not found" }, 404);
    return c.json({ status: "revoked" });
  });

  // --- Users management (super-admin only via middleware) ---

  router.get("/users", async (c) => {
    const rows = await db.select().from(users).orderBy(desc(users.createdAt));
    const utRows = await db
      .select({
        userId: userTeams.userId,
        teamId: userTeams.teamId,
        teamName: teams.name,
        teamCreatedAt: teams.createdAt,
      })
      .from(userTeams)
      .innerJoin(teams, eq(userTeams.teamId, teams.id));
    const teamsByUser = new Map<number, Array<{ id: number; name: string; createdAt: Date }>>();
    for (const r of utRows) {
      const list = teamsByUser.get(r.userId) ?? [];
      list.push({ id: r.teamId, name: r.teamName, createdAt: r.teamCreatedAt });
      teamsByUser.set(r.userId, list);
    }
    const data = rows.map((u) => ({
      ...u,
      teams: teamsByUser.get(u.id) ?? [],
    }));
    return c.json({ data });
  });

  router.get("/users/:id/teams", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return c.json({ error: "Invalid user ID" }, 400);
    }
    const rows = await db
      .select({ id: teams.id, name: teams.name, createdAt: teams.createdAt })
      .from(userTeams)
      .innerJoin(teams, eq(userTeams.teamId, teams.id))
      .where(eq(userTeams.userId, id));
    return c.json({ data: rows });
  });

  router.put("/users/:id/teams", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return c.json({ error: "Invalid user ID" }, 400);
    }
    const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!existing) return c.json({ error: "User not found" }, 404);
    const body = await c.req.json<{ teamIds: number[] }>();
    const teamIds = Array.isArray(body.teamIds)
      ? (body.teamIds as number[]).filter((n) => Number.isInteger(n) && n > 0)
      : [];
    const uniqueIds = [...new Set(teamIds)];
    await db.transaction(async (tx) => {
      await tx.delete(userTeams).where(eq(userTeams.userId, id));
      if (uniqueIds.length > 0) {
        await tx.insert(userTeams).values(uniqueIds.map((teamId) => ({ userId: id, teamId })));
      }
    });
    const rows = await db
      .select({ id: teams.id, name: teams.name, createdAt: teams.createdAt })
      .from(userTeams)
      .innerJoin(teams, eq(userTeams.teamId, teams.id))
      .where(eq(userTeams.userId, id));
    return c.json({ data: rows });
  });

  router.patch("/users/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return c.json({ error: "Invalid user ID" }, 400);
    }

    const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!existing) return c.json({ error: "User not found" }, 404);

    if (existing.isSuperAdmin) {
      return c.json({ error: "Cannot modify super admins; manage via SUPER_ADMINS env" }, 400);
    }

    const body = await c.req.json<{ disabled?: boolean }>();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.disabled === "boolean") updates.disabled = body.disabled;

    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return c.json({ data: updated });
  });

  // --- Access requests ---

  // Authenticated user checks their own request (no super-admin required)
  router.get("/access-requests/mine", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ data: null });

    const [request] = await db
      .select()
      .from(accessRequests)
      .where(eq(accessRequests.email, user.email))
      .orderBy(desc(accessRequests.requestedAt))
      .limit(1);

    return c.json({ data: request ?? null });
  });

  // Authenticated user submits a request (no super-admin required)
  router.post("/access-requests", async (c) => {
    if (!isAccessRequestsEnabled()) {
      return c.json({ error: "Access requests are not enabled" }, 403);
    }

    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const existing = await db
      .select({ id: accessRequests.id })
      .from(accessRequests)
      .where(and(eq(accessRequests.email, user.email), eq(accessRequests.status, "pending")))
      .limit(1);

    if (existing.length > 0) {
      return c.json({ error: "You already have a pending request" }, 409);
    }

    const [inserted] = await db
      .insert(accessRequests)
      .values({
        email: user.email,
        googleSub: user.googleSub ?? null,
        name: user.name ?? null,
        picture: user.picture ?? null,
      })
      .returning();

    return c.json({ data: inserted });
  });

  // Super-admin: list all access requests (filtered by status)
  router.get("/access-requests", async (c) => {
    const statusFilter = c.req.query("status");
    const conditions = statusFilter ? eq(accessRequests.status, statusFilter) : undefined;

    const rows = await db
      .select()
      .from(accessRequests)
      .where(conditions)
      .orderBy(desc(accessRequests.requestedAt));

    return c.json({ data: rows });
  });

  // Super-admin: approve request
  router.post("/access-requests/:id/approve", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return c.json({ error: "Invalid request ID" }, 400);
    }

    const currentUser = c.get("user");
    const body = await c.req.json<{ teamIds?: number[] }>().catch(() => ({ teamIds: undefined }));
    const teamIds = Array.isArray(body?.teamIds)
      ? (body?.teamIds as number[]).filter((n) => Number.isInteger(n) && n > 0)
      : [];
    const uniqueTeamIds = [...new Set(teamIds)];

    const [request] = await db
      .select()
      .from(accessRequests)
      .where(eq(accessRequests.id, id))
      .limit(1);

    if (!request) return c.json({ error: "Request not found" }, 404);
    if (request.status !== "pending") {
      return c.json({ error: `Request already ${request.status}` }, 400);
    }

    let approvedUserId: number | null = null;
    await db.transaction(async (tx) => {
      const [existingUser] = await tx
        .select()
        .from(users)
        .where(eq(users.email, request.email))
        .limit(1);

      if (existingUser) {
        await tx
          .update(users)
          .set({ disabled: false, updatedAt: new Date() })
          .where(eq(users.id, existingUser.id));
        approvedUserId = existingUser.id;
      } else if (request.googleSub) {
        const [inserted] = await tx
          .insert(users)
          .values({
            email: request.email.toLowerCase(),
            name: request.name,
            picture: request.picture,
            googleSub: request.googleSub,
            isSuperAdmin: false,
            disabled: false,
          })
          .returning({ id: users.id });
        approvedUserId = inserted.id;
      }

      if (approvedUserId != null && uniqueTeamIds.length > 0) {
        const uid = approvedUserId;
        await tx.insert(userTeams).values(uniqueTeamIds.map((teamId) => ({ userId: uid, teamId })));
      }

      await tx
        .update(accessRequests)
        .set({
          status: "approved",
          decidedBy: currentUser?.id ?? null,
          decidedAt: new Date(),
        })
        .where(eq(accessRequests.id, id));
    });

    return c.json({ status: "approved" });
  });

  // Super-admin: deny request
  router.post("/access-requests/:id/deny", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return c.json({ error: "Invalid request ID" }, 400);
    }

    const currentUser = c.get("user");
    const body = await c.req.json<{ notes?: string }>().catch(() => ({ notes: undefined }));

    const [request] = await db
      .select()
      .from(accessRequests)
      .where(eq(accessRequests.id, id))
      .limit(1);

    if (!request) return c.json({ error: "Request not found" }, 404);
    if (request.status !== "pending") {
      return c.json({ error: `Request already ${request.status}` }, 400);
    }

    await db
      .update(accessRequests)
      .set({
        status: "denied",
        decidedBy: currentUser?.id ?? null,
        decidedAt: new Date(),
        notes: body.notes?.trim() || null,
      })
      .where(eq(accessRequests.id, id));

    return c.json({ status: "denied" });
  });

  return router;
}
