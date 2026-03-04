import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { confirm, intro, isCancel, log, outro, select } from "@clack/prompts";
import { fileExists } from "./_utils.ts";

type JournalEntry = {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
};

type Journal = {
  version: string;
  dialect: string;
  entries: JournalEntry[];
};

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptsDir, "..");
const migrationsDir = path.join(rootDir, "db", "migrations");
const metaDir = path.join(migrationsDir, "meta");
const journalPath = path.join(metaDir, "_journal.json");

function parseJournal(raw: string): Journal {
  const parsed = JSON.parse(raw) as Journal;
  if (!Array.isArray(parsed.entries)) {
    throw new Error("Invalid migration journal: missing entries array.");
  }
  return parsed;
}

function snapshotPathFromEntry(entry: JournalEntry): string {
  const padded = String(entry.idx).padStart(4, "0");
  return path.join(metaDir, `${padded}_snapshot.json`);
}

async function dropLatestMigration(journal: Journal, target: JournalEntry) {
  const migrationFilePath = path.join(migrationsDir, `${target.tag}.sql`);
  const snapshotPath = snapshotPathFromEntry(target);

  if (await fileExists(migrationFilePath)) {
    await rm(migrationFilePath);
    log.info(`Deleted ${path.relative(rootDir, migrationFilePath)}`);
  } else {
    log.warn(`Skipped missing ${path.relative(rootDir, migrationFilePath)}`);
  }

  if (await fileExists(snapshotPath)) {
    await rm(snapshotPath);
    log.info(`Deleted ${path.relative(rootDir, snapshotPath)}`);
  } else {
    log.warn(`Skipped missing ${path.relative(rootDir, snapshotPath)}`);
  }

  const updatedEntries = journal.entries.filter((entry) => entry.idx !== target.idx);
  const updatedJournal: Journal = {
    ...journal,
    entries: updatedEntries,
  };

  await writeFile(journalPath, `${JSON.stringify(updatedJournal, null, 2)}\n`, "utf8");
  log.info(`Updated ${path.relative(rootDir, journalPath)}`);
}

async function main() {
  const raw = await readFile(journalPath, "utf8");
  const journal = parseJournal(raw);

  if (journal.entries.length === 0) {
    console.error("No migrations found in journal.");
    process.exit(1);
  }

  const latestEntry = journal.entries[journal.entries.length - 1];

  intro("Drop a migration");

  const selected = await select({
    message: "Select migration to drop (only latest is selectable)",
    options: journal.entries.map((entry) => {
      const isLatest = entry.idx === latestEntry.idx;
      return {
        value: entry,
        label: `${entry.tag}.sql`,
        hint: isLatest ? "latest" : "locked: newer migrations depend on this",
        disabled: !isLatest,
      };
    }),
  });

  if (isCancel(selected)) {
    outro("Cancelled.");
    process.exit(0);
  }

  log.warn(
    "This removes migration files only. If already applied to a DB, reset your local DB before running db:migrate again.",
  );

  const confirmed = await confirm({
    message: `Drop migration '${selected.tag}'?`,
  });

  if (isCancel(confirmed) || !confirmed) {
    outro("Cancelled.");
    process.exit(0);
  }

  await dropLatestMigration(journal, selected);
  outro(`Dropped latest migration '${selected.tag}'.`);
}

main().catch((error) => {
  console.error("Failed to drop migration:", error);
  process.exit(1);
});
