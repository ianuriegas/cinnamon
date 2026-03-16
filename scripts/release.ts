#!/usr/bin/env bun
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
/**
 * Release script — bumps versions in both package.json files, commits, tags, and pushes.
 *
 * Usage:
 *   bun run release          # interactive prompt
 *   bun run release 0.2.0    # explicit version
 */
import * as p from "@clack/prompts";

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_FILES = [
  resolve(ROOT, "package.json"),
  resolve(ROOT, "create-cinnamon", "package.json"),
];

function run(cmd: string) {
  console.log(`  $ ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

function getCurrentVersion(): string {
  const raw = readFileSync(PACKAGE_FILES[0], "utf-8");
  return JSON.parse(raw).version;
}

function getRecentChanges(tag: string): string {
  try {
    return execSync(`git log v${tag}..HEAD --oneline`, { cwd: ROOT, encoding: "utf-8" }).trim();
  } catch {
    return execSync("git log --oneline -10", { cwd: ROOT, encoding: "utf-8" }).trim();
  }
}

function bumpVersion(filePath: string, version: string) {
  const raw = readFileSync(filePath, "utf-8");
  const pkg = JSON.parse(raw);
  const prev = pkg.version;
  pkg.version = version;
  writeFileSync(filePath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`  ${filePath.replace(ROOT, ".")} : ${prev} → ${version}`);
}

async function promptForVersion(current: string): Promise<string> {
  const [major, minor, patch] = current.split(".").map(Number);

  const changes = getRecentChanges(current);
  if (changes) {
    p.note(changes, `Changes since v${current}`);
  }

  const version = await p.select({
    message: `Current version is v${current}. What type of release?`,
    options: [
      {
        value: `${major}.${minor}.${patch + 1}`,
        label: `Patch  ${major}.${minor}.${patch + 1}`,
        hint: "bug fixes",
      },
      {
        value: `${major}.${minor + 1}.0`,
        label: `Minor  ${major}.${minor + 1}.0`,
        hint: "new features",
      },
      { value: `${major + 1}.0.0`, label: `Major  ${major + 1}.0.0`, hint: "breaking changes" },
    ],
  });

  if (p.isCancel(version)) {
    p.cancel("Release cancelled.");
    process.exit(0);
  }

  return version as string;
}

async function main() {
  let version = process.argv[2];

  if (version && !SEMVER_RE.test(version)) {
    console.error(`Invalid version "${version}". Expected format: X.Y.Z (e.g. 0.2.0)`);
    process.exit(1);
  }

  const current = getCurrentVersion();

  if (!version) {
    p.intro("cinnamon release");
    version = await promptForVersion(current);
  }

  // Check for uncommitted changes
  const status = execSync("git status --porcelain", { cwd: ROOT, encoding: "utf-8" }).trim();
  if (status) {
    console.error("Working directory is not clean. Commit or stash changes first.\n");
    console.error(status);
    process.exit(1);
  }

  console.log(`\nReleasing v${version}...\n`);

  // 1. Bump versions
  console.log("Bumping versions:");
  for (const file of PACKAGE_FILES) {
    bumpVersion(file, version);
  }

  // 2. Commit
  console.log("\nCommitting:");
  run("git add -A");
  run(`git commit -m "release: v${version}"`);

  // 3. Tag
  console.log("\nTagging:");
  run(`git tag v${version}`);

  // 4. Push
  console.log("\nPushing:");
  run("git push");
  run("git push --tags");

  p.outro(
    `Released v${version} successfully. Workflow will build Docker, publish npm, and create GitHub Release.`,
  );
}

main();
