#!/usr/bin/env bun
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";

const TEMPLATE_DIR = join(fileURLToPath(import.meta.url), "..", "template");

function isCancel(value: unknown): value is symbol {
  return p.isCancel(value);
}

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

function parsePort(url: string, fallback: number): number {
  try {
    const parsed = new URL(url);
    return parsed.port ? Number(parsed.port) : fallback;
  } catch {
    return fallback;
  }
}

async function main() {
  const destination = process.argv[2];

  p.intro("create-cinnamon");

  const dir =
    destination ??
    ((await p.text({
      message: "Where should we create the project?",
      placeholder: "./my-cinnamon-app",
      validate: (v) => (!v?.trim() ? "Directory is required" : undefined),
    })) as string);

  if (isCancel(dir)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  const targetDir = resolve(dir);
  const projectName = basename(targetDir);

  if (existsSync(targetDir)) {
    const shouldOverwrite = await p.confirm({
      message: `Directory "${projectName}" already exists. Continue and overwrite?`,
      initialValue: false,
    });
    if (isCancel(shouldOverwrite) || !shouldOverwrite) {
      p.cancel("Setup cancelled.");
      process.exit(0);
    }
  }

  const answers = await p.group(
    {
      databaseUrl: () =>
        p.text({
          message: "Postgres connection string",
          placeholder: "postgresql://cinnamon:change-me@localhost:5432/cinnamon",
          defaultValue: "postgresql://cinnamon:change-me@localhost:5432/cinnamon",
        }),
      redisUrl: () =>
        p.text({
          message: "Redis connection string",
          placeholder: "redis://localhost:6379",
          defaultValue: "redis://localhost:6379",
        }),
      includeExampleJobs: () =>
        p.confirm({
          message: "Include example jobs?",
          initialValue: true,
        }),
      runMigrate: () =>
        p.confirm({
          message: "Run database migrations now?",
          initialValue: false,
        }),
    },
    {
      onCancel: () => {
        p.cancel("Setup cancelled.");
        process.exit(0);
      },
    },
  );

  // Check for port conflicts before proceeding
  const pgPort = parsePort(answers.databaseUrl, 5432);
  const redisPort = parsePort(answers.redisUrl, 6379);
  const busyPorts: string[] = [];
  if (await isPortInUse(pgPort)) busyPorts.push(`${pgPort} (Postgres)`);
  if (await isPortInUse(redisPort)) busyPorts.push(`${redisPort} (Redis)`);

  if (busyPorts.length > 0) {
    p.log.warn(
      `Port ${busyPorts.join(" and ")} already in use.\n` +
        "  Another Cinnamon instance or database may be running.\n" +
        "  Continuing will share that database — stop it first if you want a fresh instance.",
    );
    const shouldContinue = await p.confirm({
      message: "Continue anyway?",
      initialValue: false,
    });
    if (isCancel(shouldContinue) || !shouldContinue) {
      p.cancel("Setup cancelled.");
      process.exit(0);
    }
  }

  const s = p.spinner();

  // 1. Copy template files
  s.start("Copying template files...");
  mkdirSync(targetDir, { recursive: true });
  cpSync(TEMPLATE_DIR, targetDir, { recursive: true });

  // Rename files that are stored with alternate names to avoid tooling conflicts
  const renames: [string, string][] = [
    ["gitignore", ".gitignore"],
    ["biome.json.tmpl", "biome.json"],
  ];
  for (const [from, to] of renames) {
    const src = join(targetDir, from);
    const dst = join(targetDir, to);
    if (existsSync(src)) renameSync(src, dst);
  }

  // Remove example jobs if not requested
  if (!answers.includeExampleJobs) {
    const { rmSync } = await import("node:fs");
    const jobsDir = join(targetDir, "jobs", "hello-world");
    if (existsSync(jobsDir)) {
      rmSync(jobsDir, { recursive: true, force: true });
    }
    // Rewrite cinnamon.config.ts to empty jobs
    const configPath = join(targetDir, "cinnamon.config.ts");
    writeFileSync(
      configPath,
      `import { defineConfig } from "./config/define-config.ts";\n\nexport default defineConfig({\n  jobs: {},\n});\n`,
    );
  }

  // 2. Generate package.json from template
  const tmplPath = join(targetDir, "package.json.tmpl");
  const pkgTemplate = readFileSync(tmplPath, "utf-8");
  const pkgContent = pkgTemplate.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
  writeFileSync(join(targetDir, "package.json"), pkgContent);
  const { unlinkSync } = await import("node:fs");
  unlinkSync(tmplPath);

  // 3. Generate .env from user inputs
  const envExamplePath = join(targetDir, ".env.example");
  let envContent = readFileSync(envExamplePath, "utf-8");
  envContent = envContent.replace(/^DATABASE_URL=.*/m, `DATABASE_URL=${answers.databaseUrl}`);
  envContent = envContent.replace(/^REDIS_URL=.*/m, `REDIS_URL=${answers.redisUrl}`);
  // Derive POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB from the connection string
  try {
    const url = new URL(answers.databaseUrl);
    envContent = envContent.replace(
      /^POSTGRES_USER=.*/m,
      `POSTGRES_USER=${decodeURIComponent(url.username)}`,
    );
    envContent = envContent.replace(
      /^POSTGRES_PASSWORD=.*/m,
      `POSTGRES_PASSWORD=${decodeURIComponent(url.password)}`,
    );
    const dbName = url.pathname.replace(/^\//, "");
    envContent = envContent.replace(/^POSTGRES_DB=.*/m, `POSTGRES_DB=${dbName}`);
  } catch {
    // If URL parsing fails, leave the defaults
  }
  writeFileSync(join(targetDir, ".env"), envContent);

  // .env.local overrides BASE_URL for Vite dev server (port 5173)
  writeFileSync(join(targetDir, ".env.local"), "BASE_URL=http://localhost:5173\n");

  s.stop("Template files copied.");

  // 4. Install dependencies
  s.start("Installing dependencies...");
  try {
    execSync("bun install", { cwd: targetDir, stdio: "ignore" });
    s.stop("Dependencies installed.");
  } catch {
    s.stop("Failed to install dependencies. Run `bun install` manually.");
  }

  // 5. Optionally run migrations
  if (answers.runMigrate) {
    s.start("Running database migrations...");
    try {
      execSync("bun run db:migrate", { cwd: targetDir, stdio: "ignore", timeout: 30_000 });
      s.stop("Migrations complete.");
    } catch {
      s.stop(
        "Migration failed. Make sure Postgres is running and run `bun run db:migrate` manually.",
      );
    }
  }

  // 6. Initialize git repo
  s.start("Initializing git repository...");
  try {
    execSync("git init -b main && git add -A && git commit -m 'Initial commit'", {
      cwd: targetDir,
      stdio: "ignore",
    });
    s.stop("Git repository initialized.");
  } catch {
    s.stop("Git init failed. You can initialize it manually.");
  }

  p.note(
    [
      `cd ${dir}`,
      "",
      "# If another Cinnamon/Postgres instance is running, stop it first:",
      "# docker compose down   (in the other project)",
      "",
      "# Start Postgres + Redis (if using Docker):",
      "docker compose up -d postgres redis",
      "",
      "# Run migrations:",
      "bun run db:migrate",
      "",
      "# Start dev server + dashboard:",
      "bun run dev",
    ].join("\n"),
    "Next steps",
  );

  p.outro("Your Cinnamon project is ready!");
}

main().catch((err) => {
  p.log.error(err.message);
  process.exit(1);
});
