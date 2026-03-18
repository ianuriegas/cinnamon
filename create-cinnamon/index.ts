#!/usr/bin/env bun
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";

const TEMPLATES_DIR = join(fileURLToPath(import.meta.url), "..", "templates");

function isCancel(value: unknown): value is symbol {
  return p.isCancel(value);
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

  const answers = await p.group(
    {
      includeExampleJobs: () => p.confirm({ message: "Include example jobs?", initialValue: true }),
    },
    { onCancel: cancelAndExit },
  );
  const includeExampleJobs = answers.includeExampleJobs;

  let authEnabled = false;
  let superAdminEmails = "";

  const setupAuth = await p.confirm({
    message: "Set up Google OAuth for the dashboard? (can be done later)",
    initialValue: false,
  });
  if (isCancel(setupAuth)) cancelAndExit();

  if (setupAuth) {
    const emails = (await p.text({
      message: "Super admin email(s) (comma-separated for multiple)",
      placeholder: "you@gmail.com, teammate@gmail.com",
      validate: (v) => {
        if (!v?.trim()) return "At least one email is required";
        const list = v
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);
        if (list.length === 0) return "At least one email is required";
        const bad = list.find((e) => !e.includes("@"));
        if (bad) return `Invalid email: ${bad}`;
      },
    })) as string;
    if (isCancel(emails)) cancelAndExit();

    authEnabled = true;
    superAdminEmails = emails
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean)
      .join(",");
  }

  const s = p.spinner();

  await scaffoldDocker({ targetDir, projectName, includeExampleJobs, s });

  if (authEnabled) {
    writeAuthEnv(targetDir, superAdminEmails);
  }

  printNextSteps(dir, authEnabled);
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
  fillReadmeProjectName(targetDir, projectName);
  generateEnvFromExample(targetDir);

  s.stop("Template files copied.");

  s.start("Pulling Docker image...");
  try {
    execSync("docker compose pull", { cwd: targetDir, stdio: "ignore", timeout: 120_000 });
    s.stop("Docker image pulled.");
  } catch {
    s.stop("Could not pull image now. It will be pulled on first `bun run dev`.");
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

function fillReadmeProjectName(targetDir: string, projectName: string) {
  const readmePath = join(targetDir, "README.md");
  if (!existsSync(readmePath)) return;
  const content = readFileSync(readmePath, "utf-8").replace(/\{\{PROJECT_NAME\}\}/g, projectName);
  writeFileSync(readmePath, content);
}

function generateEnvFromExample(targetDir: string) {
  const envExamplePath = join(targetDir, ".env.example");
  if (!existsSync(envExamplePath)) return;
  const envContent = readFileSync(envExamplePath, "utf-8");
  writeFileSync(join(targetDir, ".env"), envContent);
}

function writeAuthEnv(targetDir: string, superAdminEmails: string) {
  const envPath = join(targetDir, ".env");
  const sessionSecret = randomBytes(32).toString("base64");
  let content = readFileSync(envPath, "utf-8");

  content = content.replace(/^# SESSION_SECRET=.*$/m, `SESSION_SECRET=${sessionSecret}`);
  content = content.replace(/^# SUPER_ADMINS=.*$/m, `SUPER_ADMINS=${superAdminEmails}`);

  writeFileSync(envPath, content);
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

function printNextSteps(dir: string, authEnabled: boolean) {
  const authLines = authEnabled
    ? [
        "",
        "# Dashboard auth is enabled. Add your Google OAuth credentials:",
        "# Place client_secret.json in the project root, or set",
        "# GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env",
      ]
    : [];

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
      ...authLines,
    ].join("\n"),
    "Next steps",
  );
}

main().catch((err) => {
  p.log.error(err.message);
  process.exit(1);
});
