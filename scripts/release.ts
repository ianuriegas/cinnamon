#!/usr/bin/env bun
/**
 * Release script — bumps versions in both package.json files, commits, tags, and pushes.
 *
 * Usage: bun run release <version>
 * Example: bun run release 0.1.0
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

function bumpVersion(filePath: string, version: string) {
  const raw = readFileSync(filePath, "utf-8");
  const pkg = JSON.parse(raw);
  const prev = pkg.version;
  pkg.version = version;
  writeFileSync(filePath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`  ${filePath.replace(ROOT, ".")} : ${prev} → ${version}`);
}

function main() {
  const version = process.argv[2];

  if (!version) {
    console.error("Usage: bun run release <version>");
    console.error("Example: bun run release 0.1.0");
    process.exit(1);
  }

  if (!SEMVER_RE.test(version)) {
    console.error(`Invalid version "${version}". Expected format: X.Y.Z (e.g. 0.1.0)`);
    process.exit(1);
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
  run(`git commit -m "chore: bump to v${version}"`);

  // 3. Tag
  console.log("\nTagging:");
  run(`git tag v${version}`);

  // 4. Push
  console.log("\nPushing:");
  run("git push");
  run("git push --tags");

  console.log(`\nReleased v${version} successfully.`);
  console.log(
    "The release workflow will now run checks, build Docker, publish to npm, and create a GitHub Release.",
  );
}

main();
