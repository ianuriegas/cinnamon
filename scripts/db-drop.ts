import { access, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { clearScreenDown, cursorTo, emitKeypressEvents, moveCursor } from "node:readline";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  hideCursor: "\x1b[?25l",
  showCursor: "\x1b[?25h",
} as const;

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

type MigrationChoice = {
  label: string;
  entry: JournalEntry;
  locked: boolean;
};

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptsDir, "..");
const migrationsDir = path.join(rootDir, "db", "migrations");
const metaDir = path.join(migrationsDir, "meta");
const journalPath = path.join(metaDir, "_journal.json");

function clearRenderedLines(lineCount: number) {
  if (lineCount <= 0) return;
  moveCursor(output, 0, -lineCount);
  cursorTo(output, 0);
  clearScreenDown(output);
}

function countLinesForWidth(line: string): number {
  const width = output.columns && output.columns > 0 ? output.columns : 80;
  return Math.max(1, Math.ceil(line.length / width));
}

function renderMenu(choices: MigrationChoice[], selectedIndex: number): number {
  let renderedLines = 0;

  const title = `${ANSI.bold}Select migration to drop${ANSI.reset}`;
  const hint = `${ANSI.dim}Only latest migration is selectable. ↑/↓ move  Enter select  q cancel${ANSI.reset}`;
  output.write(`${title}\n${hint}\n\n`);
  renderedLines += countLinesForWidth(title) + countLinesForWidth(hint) + 1;

  for (const [index, choice] of choices.entries()) {
    const isSelected = index === selectedIndex;
    const marker = isSelected ? `${ANSI.green}>${ANSI.reset}` : " ";
    const lockLabel = choice.locked
      ? `${ANSI.dim}[locked: newer migrations depend on this]${ANSI.reset}`
      : `${ANSI.bold}[latest]${ANSI.reset}`;
    const label = choice.locked ? `${ANSI.dim}${choice.label}${ANSI.reset}` : choice.label;
    const line = `${marker} ${label} ${lockLabel}`;
    output.write(`${line}\n`);
    renderedLines += countLinesForWidth(line);
  }

  return renderedLines;
}

function parseJournal(raw: string): Journal {
  const parsed = JSON.parse(raw) as Journal;
  if (!Array.isArray(parsed.entries)) {
    throw new Error("Invalid migration journal: missing entries array.");
  }
  return parsed;
}

function buildChoices(entries: JournalEntry[]): MigrationChoice[] {
  return entries.map((entry, index) => ({
    entry,
    label: `${entry.tag}.sql`,
    locked: index !== entries.length - 1,
  }));
}

function firstSelectableIndex(choices: MigrationChoice[]): number {
  const index = choices.findIndex((choice) => !choice.locked);
  return index === -1 ? 0 : index;
}

function stepSelectableIndex(
  choices: MigrationChoice[],
  selectedIndex: number,
  direction: 1 | -1,
): number {
  if (choices.length === 0) return selectedIndex;
  let next = selectedIndex;
  for (let steps = 0; steps < choices.length; steps++) {
    next = (next + direction + choices.length) % choices.length;
    if (!choices[next]?.locked) {
      return next;
    }
  }
  return selectedIndex;
}

async function chooseFromMenu(choices: MigrationChoice[]): Promise<MigrationChoice | null> {
  return await new Promise<MigrationChoice | null>((resolve) => {
    let selectedIndex = firstSelectableIndex(choices);
    let renderedLines = 0;
    let finished = false;

    const redraw = () => {
      if (renderedLines > 0) {
        clearRenderedLines(renderedLines);
      }
      renderedLines = renderMenu(choices, selectedIndex);
    };

    const cleanup = (result: MigrationChoice | null) => {
      if (finished) return;
      finished = true;

      input.off("keypress", onKeypress);
      if (input.isTTY) input.setRawMode(false);
      input.pause();
      output.write(ANSI.showCursor);

      if (renderedLines > 0) {
        clearRenderedLines(renderedLines);
      }

      resolve(result);
    };

    const onKeypress = (_: string, key: { ctrl?: boolean; name?: string }) => {
      if (key.ctrl && key.name === "c") {
        cleanup(null);
        return;
      }

      if (key.name === "up" || key.name === "k") {
        selectedIndex = stepSelectableIndex(choices, selectedIndex, -1);
        redraw();
        return;
      }

      if (key.name === "down" || key.name === "j") {
        selectedIndex = stepSelectableIndex(choices, selectedIndex, 1);
        redraw();
        return;
      }

      if (key.name === "return") {
        const selected = choices[selectedIndex] ?? null;
        cleanup(selected && !selected.locked ? selected : null);
        return;
      }

      if (key.name === "q" || key.name === "escape") {
        cleanup(null);
      }
    };

    emitKeypressEvents(input);
    input.on("keypress", onKeypress);
    if (input.isTTY) input.setRawMode(true);
    input.resume();
    output.write(ANSI.hideCursor);
    redraw();
  });
}

async function chooseFromPrompt(choices: MigrationChoice[]): Promise<MigrationChoice | null> {
  console.log("Migrations:");
  for (const [index, choice] of choices.entries()) {
    const status = choice.locked ? "locked" : "latest";
    console.log(`  ${index + 1}. ${choice.label} (${status})`);
  }

  const selectableNumber = choices.findIndex((choice) => !choice.locked) + 1;
  if (selectableNumber <= 0) {
    return null;
  }

  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(`Pick migration number to drop (only ${selectableNumber} is allowed): `);
    const selected = Number(answer.trim());
    if (selected !== selectableNumber) {
      console.error("Only the latest migration can be dropped.");
      return null;
    }
    return choices[selected - 1] ?? null;
  } finally {
    rl.close();
  }
}

async function chooseMigration(choices: MigrationChoice[]): Promise<MigrationChoice | null> {
  if (input.isTTY && output.isTTY) {
    return chooseFromMenu(choices);
  }
  return chooseFromPrompt(choices);
}

async function confirmDrop(choice: MigrationChoice): Promise<boolean> {
  const rl = createInterface({ input, output });
  try {
    console.log(
      `${ANSI.yellow}This removes migration files only.${ANSI.reset} If this migration was already applied to a DB, reset your local DB before running db:migrate again.`,
    );
    const answer = await rl.question(
      `Type ${ANSI.bold}drop ${choice.entry.tag}${ANSI.reset} to confirm: `,
    );
    return answer.trim() === `drop ${choice.entry.tag}`;
  } finally {
    rl.close();
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
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
    console.log(`Deleted ${path.relative(rootDir, migrationFilePath)}`);
  } else {
    console.log(
      `${ANSI.yellow}Skipped${ANSI.reset} missing ${path.relative(rootDir, migrationFilePath)}`,
    );
  }

  if (await fileExists(snapshotPath)) {
    await rm(snapshotPath);
    console.log(`Deleted ${path.relative(rootDir, snapshotPath)}`);
  } else {
    console.log(`${ANSI.yellow}Skipped${ANSI.reset} missing ${path.relative(rootDir, snapshotPath)}`);
  }

  const updatedEntries = journal.entries.filter((entry) => entry.idx !== target.idx);
  const updatedJournal: Journal = {
    ...journal,
    entries: updatedEntries,
  };

  await writeFile(journalPath, `${JSON.stringify(updatedJournal, null, 2)}\n`, "utf8");
  console.log(`Updated ${path.relative(rootDir, journalPath)}`);
}

async function main() {
  const raw = await readFile(journalPath, "utf8");
  const journal = parseJournal(raw);

  if (journal.entries.length === 0) {
    console.error("No migrations found in journal.");
    process.exit(1);
  }

  const choices = buildChoices(journal.entries);
  const selected = await chooseMigration(choices);

  if (!selected) {
    console.error("No migration selected.");
    process.exit(1);
  }

  if (selected.locked) {
    console.error("Only the latest migration can be dropped.");
    process.exit(1);
  }

  const confirmed = await confirmDrop(selected);
  if (!confirmed) {
    console.error("Cancelled.");
    process.exit(1);
  }

  await dropLatestMigration(journal, selected.entry);
  console.log(`${ANSI.green}Done.${ANSI.reset} Dropped latest migration '${selected.entry.tag}'.`);
}

main().catch((error) => {
  console.error(`${ANSI.red}Failed to drop migration:${ANSI.reset}`, error);
  process.exit(1);
});
