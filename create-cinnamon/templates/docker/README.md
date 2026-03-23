# {{PROJECT_NAME}} — Cinnamon (Docker mode)

Job orchestration powered by [Cinnamon](https://github.com/ianuriegas/cinnamon).

## Quick start

```bash
bun run dev           # starts all services (pulls latest image automatically)
```

Dashboard: http://localhost:3000/dashboard

## Commands

| Command | What it does |
|---|---|
| `bun run dev` | Start all services (Postgres, Redis, API, worker, scheduler) |
| `bun run deploy` | Start services in detached mode, rebuild, and prune old images |
| `bun run db:migrate` | Run database migrations (core + custom) |
| `bun run db:generate` | Generate a migration from your custom schema |
| `bun run db:drop` | Drop the latest custom migration (file only) |
| `bun run seed:team` | Create a team + API key |
| `bun run worker` | Start only the worker |
| `bun run scheduler` | Start only the scheduler |
| `bun run server` | Start only the API server |
| `bun run logs` | Tail logs from all services |
| `bun run down` | Stop all services |
| `bun run pull` | Pull latest cinnamon image |

## Adding jobs

1. Add an entry to `cinnamon.config.ts`
2. Create the script in `jobs/` (Python, Bash, Node — anything that runs in a shell)
3. Trigger via CLI (`cinnamon trigger <name>`) or API

The `jobs/` directory is volume-mounted into the container, so changes take effect immediately.

## Writing TypeScript jobs

TypeScript jobs can import utilities that work both locally (for editor support) and inside Docker (at runtime):

```ts
// Use isDirectExecution for scripts that can be run directly or as a job
import { isDirectExecution } from "@/src/lib/is-direct-execution.ts";

// Use the Drizzle client to query your custom tables
import { db } from "@/db/index.ts";

// Import your custom schema — @/db/custom-schema/ maps to db/schema/ locally
import { metrics } from "@/db/custom-schema/metrics.ts";
```

The `@/` path alias resolves to the project root locally (via `tsconfig.json`) and to `/app` inside Docker. The `@/db/custom-schema/*` alias maps to your local `db/schema/` directory so the same import paths work in both environments.

## Custom tables

You can add your own database tables without forking Cinnamon. Custom tables live
in the `public` schema, isolated from Cinnamon's internal `cinnamon.*` tables.
Your migrations are tracked independently, so upgrading the Cinnamon image never
interferes with your data.

### 1. Define your schema

Create a file in `db/schema/` using [Drizzle ORM](https://orm.drizzle.team/docs/sql-schema-declaration) syntax. See `db/schema/example.ts.bak` for a starter template.

```ts
// db/schema/metrics.ts
import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const metrics = pgTable("metrics", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  value: integer("value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### 2. Generate a migration

```bash
bun run db:generate
```

This diffs your schema files against the current migration state and writes a new
SQL migration to `db/migrations/`.

### 3. Apply it

```bash
bun run db:migrate
```

Both Cinnamon's core migrations and your custom migrations run automatically.

### Undo a migration

To remove the latest custom migration file (before it's been applied):

```bash
bun run db:drop
```

This only removes the local SQL file. If the migration was already applied to
the database, you'll need to manually revert the changes or recreate the database.

> **Tip:** To add a foreign key to a Cinnamon table, edit the generated SQL
> migration and add the constraint manually, e.g.
> `FOREIGN KEY ("team_id") REFERENCES "cinnamon"."teams"("id")`.

## Updating cinnamon

Set `CINNAMON_VERSION` in `.env` to a specific tag, or run `bun run pull` to fetch the latest image.

## Configuration

Edit `.env` for database credentials, webhooks, OAuth settings, and more. See `.env.example` for all options.
