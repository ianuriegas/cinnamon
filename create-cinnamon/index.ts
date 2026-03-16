#!/usr/bin/env bun
import { execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createConnection } from "node:net";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";

const TEMPLATES_DIR = join(fileURLToPath(import.meta.url), "..", "templates");

type Mode = "docker" | "submodule" | "source";

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

function cancelAndExit(): never {
  p.cancel("Setup cancelled.");
  process.exit(0);
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

  if (isCancel(dir)) cancelAndExit();

  const targetDir = resolve(dir);
  const projectName = basename(targetDir);

  if (existsSync(targetDir)) {
    const shouldOverwrite = await p.confirm({
      message: `Directory "${projectName}" already exists. Continue and overwrite?`,
      initialValue: false,
    });
    if (isCancel(shouldOverwrite) || !shouldOverwrite) cancelAndExit();
  }

  const mode = (await p.select({
    message: "Setup mode",
    options: [
      {
        value: "docker",
        label: "Docker Image (recommended)",
        hint: "uses pre-built image from GHCR",
      },
      { value: "submodule", label: "Git Submodule", hint: "pins cinnamon source as a submodule" },
      { value: "source", label: "Full Source", hint: "copies full cinnamon source into project" },
    ],
  })) as Mode;

  if (isCancel(mode)) cancelAndExit();

  // Docker mode: DB/Redis are configured via .env, no need to prompt
  // Submodule and Source modes: prompt for connection strings
  let databaseUrl = "postgresql://cinnamon:change-me@localhost:5432/cinnamon";
  let redisUrl = "redis://localhost:6379";
  let includeExampleJobs = true;
  let runMigrate = false;

  if (mode === "docker") {
    const answers = await p.group(
      {
        includeExampleJobs: () =>
          p.confirm({ message: "Include example jobs?", initialValue: true }),
      },
      { onCancel: cancelAndExit },
    );
    includeExampleJobs = answers.includeExampleJobs;
  } else {
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
          p.confirm({ message: "Include example jobs?", initialValue: true }),
        runMigrate: () =>
          p.confirm({ message: "Run database migrations now?", initialValue: false }),
      },
      { onCancel: cancelAndExit },
    );
    databaseUrl = answers.databaseUrl;
    redisUrl = answers.redisUrl;
    includeExampleJobs = answers.includeExampleJobs;
    runMigrate = answers.runMigrate;

    // Check for port conflicts
    const pgPort = parsePort(databaseUrl, 5432);
    const redisPort = parsePort(redisUrl, 6379);
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
      if (isCancel(shouldContinue) || !shouldContinue) cancelAndExit();
    }
  }

  const s = p.spinner();

  if (mode === "docker") {
    await scaffoldDocker({ targetDir, projectName, includeExampleJobs, s });
  } else if (mode === "submodule") {
    await scaffoldSubmodule({
      targetDir,
      projectName,
      databaseUrl,
      redisUrl,
      includeExampleJobs,
      runMigrate,
      s,
    });
  } else {
    await scaffoldSource({
      targetDir,
      projectName,
      databaseUrl,
      redisUrl,
      includeExampleJobs,
      runMigrate,
      s,
    });
  }

  printNextSteps(mode, dir);
  p.outro("Your Cinnamon project is ready!");
}

// ── Docker mode ──────────────────────────────────────────────────────

interface DockerOpts {
  targetDir: string;
  projectName: string;
  includeExampleJobs: boolean;
  s: ReturnType<typeof p.spinner>;
}

async function scaffoldDocker({ targetDir, projectName, includeExampleJobs, s }: DockerOpts) {
  s.start("Copying template files...");
  mkdirSync(targetDir, { recursive: true });
  cpSync(join(TEMPLATES_DIR, "docker"), targetDir, { recursive: true });

  renameIfExists(targetDir, "gitignore", ".gitignore");
  removeExampleJobsIfNeeded(targetDir, includeExampleJobs);
  generatePackageJson(targetDir, projectName);
  generateEnvFromExample(targetDir);

  s.stop("Template files copied.");

  initGitRepo(targetDir, s);
}

// ── Submodule mode ───────────────────────────────────────────────────

interface SubmoduleOpts {
  targetDir: string;
  projectName: string;
  databaseUrl: string;
  redisUrl: string;
  includeExampleJobs: boolean;
  runMigrate: boolean;
  s: ReturnType<typeof p.spinner>;
}

async function scaffoldSubmodule({
  targetDir,
  projectName,
  databaseUrl,
  redisUrl,
  includeExampleJobs,
  runMigrate,
  s,
}: SubmoduleOpts) {
  s.start("Copying template files...");
  mkdirSync(targetDir, { recursive: true });
  cpSync(join(TEMPLATES_DIR, "submodule"), targetDir, { recursive: true });

  renameIfExists(targetDir, "gitignore", ".gitignore");
  removeExampleJobsIfNeeded(targetDir, includeExampleJobs);
  generatePackageJson(targetDir, projectName);

  s.stop("Template files copied.");

  // Initialize git and add submodule
  s.start("Adding cinnamon submodule...");
  try {
    execSync("git init -b main", { cwd: targetDir, stdio: "ignore" });
    execSync("git submodule add https://github.com/ianuriegas/cinnamon.git cinnamon", {
      cwd: targetDir,
      stdio: "ignore",
    });
    s.stop("Submodule added.");
  } catch {
    s.stop(
      "Failed to add submodule. Run `git submodule add https://github.com/ianuriegas/cinnamon.git cinnamon` manually.",
    );
  }

  const cinnamonDir = join(targetDir, "cinnamon");

  // Symlink config and jobs into the submodule so it finds them
  s.start("Linking config and jobs into submodule...");
  try {
    const configSrc = join(targetDir, "cinnamon.config.ts");
    const configDst = join(cinnamonDir, "cinnamon.config.ts");
    if (existsSync(configSrc) && existsSync(cinnamonDir)) {
      if (existsSync(configDst)) unlinkSync(configDst);
      symlinkSync("../cinnamon.config.ts", configDst);
    }

    const jobsSrc = join(targetDir, "jobs");
    const jobsDst = join(cinnamonDir, "jobs");
    if (existsSync(jobsSrc) && existsSync(cinnamonDir)) {
      if (existsSync(jobsDst)) rmSync(jobsDst, { recursive: true, force: true });
      symlinkSync("../jobs", jobsDst);
    }
    s.stop("Config and jobs linked.");
  } catch {
    s.stop(
      "Failed to create symlinks. You may need to link cinnamon.config.ts and jobs/ manually.",
    );
  }

  // Generate .env in submodule directory (where cinnamon reads it)
  if (existsSync(join(cinnamonDir, ".env.example"))) {
    generateEnvWithUrls(cinnamonDir, databaseUrl, redisUrl);
  }
  // Also write .env.local for Vite dev server
  writeFileSync(join(cinnamonDir, ".env.local"), "BASE_URL=http://localhost:5173\n");

  // Install dependencies inside submodule
  s.start("Installing dependencies...");
  try {
    execSync("bun install", { cwd: cinnamonDir, stdio: "ignore" });
    s.stop("Dependencies installed.");
  } catch {
    s.stop("Failed to install dependencies. Run `cd cinnamon && bun install` manually.");
  }

  // Optionally run migrations
  if (runMigrate) {
    s.start("Running database migrations...");
    try {
      execSync("bun run db:migrate", { cwd: cinnamonDir, stdio: "ignore", timeout: 30_000 });
      s.stop("Migrations complete.");
    } catch {
      s.stop(
        "Migration failed. Make sure Postgres is running and run `bun run db:migrate` manually.",
      );
    }
  }

  // Commit everything
  s.start("Creating initial commit...");
  try {
    execSync("git add -A && git commit -m 'Initial commit'", {
      cwd: targetDir,
      stdio: "ignore",
    });
    s.stop("Git repository initialized.");
  } catch {
    s.stop("Git commit failed. You can commit manually.");
  }
}

// ── Source mode (original behavior) ──────────────────────────────────

interface SourceOpts {
  targetDir: string;
  projectName: string;
  databaseUrl: string;
  redisUrl: string;
  includeExampleJobs: boolean;
  runMigrate: boolean;
  s: ReturnType<typeof p.spinner>;
}

async function scaffoldSource({
  targetDir,
  projectName,
  databaseUrl,
  redisUrl,
  includeExampleJobs,
  runMigrate,
  s,
}: SourceOpts) {
  s.start("Copying template files...");
  mkdirSync(targetDir, { recursive: true });
  cpSync(join(TEMPLATES_DIR, "source"), targetDir, { recursive: true });

  const renames: [string, string][] = [
    ["gitignore", ".gitignore"],
    ["biome.json.tmpl", "biome.json"],
  ];
  for (const [from, to] of renames) renameIfExists(targetDir, from, to);

  if (!includeExampleJobs) {
    const jobsDir = join(targetDir, "jobs", "hello-world");
    if (existsSync(jobsDir)) rmSync(jobsDir, { recursive: true, force: true });
    writeFileSync(
      join(targetDir, "cinnamon.config.ts"),
      `import { defineConfig } from "./config/define-config.ts";\n\nexport default defineConfig({\n  jobs: {},\n});\n`,
    );
  }

  generatePackageJson(targetDir, projectName);
  generateEnvWithUrls(targetDir, databaseUrl, redisUrl);
  writeFileSync(join(targetDir, ".env.local"), "BASE_URL=http://localhost:5173\n");

  s.stop("Template files copied.");

  s.start("Installing dependencies...");
  try {
    execSync("bun install", { cwd: targetDir, stdio: "ignore" });
    s.stop("Dependencies installed.");
  } catch {
    s.stop("Failed to install dependencies. Run `bun install` manually.");
  }

  if (runMigrate) {
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

  initGitRepo(targetDir, s);
}

// ── Shared helpers ───────────────────────────────────────────────────

function renameIfExists(dir: string, from: string, to: string) {
  const src = join(dir, from);
  const dst = join(dir, to);
  if (existsSync(src)) renameSync(src, dst);
}

function removeExampleJobsIfNeeded(targetDir: string, includeExampleJobs: boolean) {
  if (includeExampleJobs) return;
  const jobsDir = join(targetDir, "jobs", "hello-world");
  if (existsSync(jobsDir)) rmSync(jobsDir, { recursive: true, force: true });
  writeFileSync(
    join(targetDir, "cinnamon.config.ts"),
    `import { defineConfig } from "./config/define-config.ts";\n\nexport default defineConfig({\n  jobs: {},\n});\n`,
  );
}

function generatePackageJson(targetDir: string, projectName: string) {
  const tmplPath = join(targetDir, "package.json.tmpl");
  if (!existsSync(tmplPath)) return;
  const content = readFileSync(tmplPath, "utf-8").replace(/\{\{PROJECT_NAME\}\}/g, projectName);
  writeFileSync(join(targetDir, "package.json"), content);
  unlinkSync(tmplPath);
}

function generateEnvFromExample(targetDir: string) {
  const envExamplePath = join(targetDir, ".env.example");
  if (!existsSync(envExamplePath)) return;
  const envContent = readFileSync(envExamplePath, "utf-8");
  writeFileSync(join(targetDir, ".env"), envContent);
}

function generateEnvWithUrls(targetDir: string, databaseUrl: string, redisUrl: string) {
  const envExamplePath = join(targetDir, ".env.example");
  if (!existsSync(envExamplePath)) return;
  let envContent = readFileSync(envExamplePath, "utf-8");
  envContent = envContent.replace(/^DATABASE_URL=.*/m, `DATABASE_URL=${databaseUrl}`);
  envContent = envContent.replace(/^REDIS_URL=.*/m, `REDIS_URL=${redisUrl}`);
  try {
    const url = new URL(databaseUrl);
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
    // If URL parsing fails, leave defaults
  }
  writeFileSync(join(targetDir, ".env"), envContent);
}

function initGitRepo(targetDir: string, s: ReturnType<typeof p.spinner>) {
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
}

function printNextSteps(mode: Mode, dir: string) {
  if (mode === "docker") {
    p.note(
      [
        `cd ${dir}`,
        "",
        "# Edit .env with your values, then start everything:",
        "bun run dev",
        "",
        "# Or start individual services:",
        "bun run db:migrate",
        "bun run seed:team",
        "bun run worker",
        "bun run server",
        "",
        "# View logs:",
        "bun run logs",
        "",
        "# Dashboard: http://localhost:3000/dashboard",
      ].join("\n"),
      "Next steps",
    );
  } else if (mode === "submodule") {
    p.note(
      [
        `cd ${dir}`,
        "",
        "# Start Postgres + Redis:",
        "bun run infra",
        "",
        "# Run migrations and seed a team:",
        "bun run db:migrate",
        "bun run seed:team",
        "",
        "# Start dev server + dashboard:",
        "bun run dev",
        "",
        "# Dashboard: http://localhost:5173/dashboard",
      ].join("\n"),
      "Next steps",
    );
  } else {
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
  }
}

main().catch((err) => {
  p.log.error(err.message);
  process.exit(1);
});
