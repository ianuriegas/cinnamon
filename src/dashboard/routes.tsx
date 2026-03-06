import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { Hono } from "hono";

import type { CinnamonConfig } from "@/config/define-config.ts";
import { db } from "@/db/index.ts";
import { jobsLog } from "@/db/schema/jobs-log.ts";
import { JOB_STATUS } from "@/src/job-types.ts";
import { DefinitionsPage } from "./pages/definitions.tsx";
import {
  RunDetailContent,
  RunDetailPage,
  formatJson,
  isShellResult,
} from "./pages/run-detail.tsx";
import { RunsPage, RunsTableFragment } from "./pages/runs.tsx";
import { SchedulesPage } from "./pages/schedules.tsx";
import { TriggerResult } from "./partials/trigger-btn.tsx";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

interface DashboardDeps {
  config: CinnamonConfig;
  jobsQueue: import("bullmq").Queue;
  jobHandlers: Record<string, unknown>;
}

export function createDashboardRouter({ config, jobsQueue, jobHandlers }: DashboardDeps) {
  const router = new Hono();

  // --- helper: build runs query ---
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

  // --- Runs list (dashboard home) ---
  router.get("/", async (c) => {
    const { limitParam, offsetParam, nameFilter, statusFilter, sinceFilter, where } =
      parseRunsQuery(c);

    const [{ rows, total }, jobNameRows] = await Promise.all([
      fetchRuns(where, limitParam, offsetParam),
      db
        .selectDistinct({ jobName: jobsLog.jobName })
        .from(jobsLog)
        .orderBy(jobsLog.jobName),
    ]);

    const jobNames = jobNameRows.map((r) => r.jobName);

    return c.html(
      <RunsPage
        runs={rows}
        pagination={{ total, limit: limitParam, offset: offsetParam }}
        filters={{ name: nameFilter, status: statusFilter, since: sinceFilter }}
        jobNames={jobNames}
      />,
    );
  });

  // --- Partial: runs table (htmx polling) ---
  router.get("/partials/runs-table", async (c) => {
    const { limitParam, offsetParam, nameFilter, statusFilter, sinceFilter, where } =
      parseRunsQuery(c);

    const { rows, total } = await fetchRuns(where, limitParam, offsetParam);

    const activeQs = [
      nameFilter && `name=${encodeURIComponent(nameFilter)}`,
      statusFilter && `status=${encodeURIComponent(statusFilter)}`,
      sinceFilter && `since=${encodeURIComponent(sinceFilter)}`,
    ]
      .filter(Boolean)
      .join("&");

    return c.html(
      <RunsTableFragment
        runs={rows}
        pagination={{ total, limit: limitParam, offset: offsetParam }}
        activeQs={activeQs}
      />,
    );
  });

  async function findRunByParam(idParam: string) {
    let [row] = await db
      .select()
      .from(jobsLog)
      .where(eq(jobsLog.jobId, idParam))
      .limit(1);

    if (!row) {
      const numericId = Number(idParam);
      if (Number.isInteger(numericId) && numericId > 0) {
        [row] = await db
          .select()
          .from(jobsLog)
          .where(eq(jobsLog.id, numericId))
          .limit(1);
      }
    }

    return row ?? null;
  }

  // --- Partial: run detail (htmx polling) ---
  router.get("/partials/runs/:id", async (c) => {
    const row = await findRunByParam(c.req.param("id"));
    if (!row) return c.text("Run not found", 404);
    return c.html(<RunDetailContent run={row} />);
  });

  // --- Run detail ---
  router.get("/runs/:id", async (c) => {
    const row = await findRunByParam(c.req.param("id"));

    if (!row) {
      return c.html(
        <div class="text-center py-12">
          <p class="text-lg">Run not found</p>
          <a href="/dashboard" class="btn btn-sm btn-primary mt-4">
            ← Back to runs
          </a>
        </div>,
        404,
      );
    }

    return c.html(<RunDetailPage run={row} />);
  });

  // --- Raw logs (plain text) ---
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

    const body = parts.length > 0 ? parts.join("\n\n") : "No output for this run.";
    return c.text(body);
  });

  // --- Definitions ---
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

    return c.html(<DefinitionsPage definitions={definitions} />);
  });

  // --- Schedules ---
  router.get("/schedules", async (c) => {
    let schedulers: Array<{ name: string; pattern: string; next: number | null }> = [];
    try {
      const raw = await jobsQueue.getJobSchedulers(0, -1);
      schedulers = raw
        .filter((s): s is typeof s & { pattern: string } => typeof s.pattern === "string")
        .map((s) => ({
          name: s.name,
          pattern: s.pattern,
          next: s.next ?? null,
        }));
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
          completed:
            sql<number>`count(*) filter (where ${jobsLog.status} = 'completed')`.mapWith(Number),
          failed:
            sql<number>`count(*) filter (where ${jobsLog.status} = 'failed')`.mapWith(Number),
        })
        .from(jobsLog)
        .where(
          sql`${jobsLog.jobName} in ${scheduledJobNames}`,
        )
        .groupBy(jobsLog.jobName);

      statsMap = new Map(statsRows.map((r) => [r.jobName, r]));
    }

    const schedules = schedulers.map((s) => ({
      name: s.name,
      pattern: s.pattern,
      next: s.next ? new Date(s.next).toISOString() : null,
      stats: statsMap.get(s.name) ?? { total: 0, completed: 0, failed: 0 },
    }));

    return c.html(<SchedulesPage schedules={schedules} />);
  });

  // --- Trigger (htmx endpoint) ---
  router.post("/trigger/:name", async (c) => {
    const name = c.req.param("name");

    if (!(name in jobHandlers)) {
      return c.html(<TriggerResult jobName={name} error={`Unknown job: ${name}`} />);
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

      return c.html(<TriggerResult jobName={name} jobId={jobId} />);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to enqueue";
      return c.html(<TriggerResult jobName={name} error={msg} />);
    }
  });

  return router;
}
