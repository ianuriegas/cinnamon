# Migrations

Cinnamon uses [Drizzle ORM](https://orm.drizzle.team/) for schema definitions and migrations.

## Schema namespacing

All core tables live under a dedicated `cinnamon` Postgres schema rather than the default `public` schema. This prevents table name collisions when cinnamon is added as a submodule inside a larger project that has its own tables.

```sql
-- Cinnamon tables live here:
SELECT * FROM "cinnamon"."jobs_log";
SELECT * FROM "cinnamon"."teams";
SELECT * FROM "cinnamon"."api_keys";

-- Your app tables live in public (or your own schema):
SELECT * FROM "public"."users";
```

## Running migrations

Apply pending migrations:

```bash
bun run db:migrate
# or equivalently:
bun run cinnamon:migrate
```

Reset the local database (drops everything and re-applies all migrations):

```bash
bun run db:reset-local
```

Generate a new migration after schema changes:

```bash
bun run db:generate
```

## Dual migration pattern (submodule users)

When cinnamon is a git submodule inside your project, you run two separate sets of migrations — cinnamon's and your own. They don't interfere because they target different Postgres schemas.

### Directory layout

```
your-project/
  cinnamon/              # git submodule
    db/
      schema/            # cinnamon schema definitions (cinnamon.*)
      migrations/        # pre-generated, committed
    drizzle.config.ts    # points at cinnamon's schema dir
  db/
    schema/              # your app schema definitions (public.*)
    migrations/          # your app migrations
  drizzle.config.ts      # points at your app's schema dir
```

### Your app's drizzle.config.ts

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema",       // your app's schema (public.*)
  out: "./db/migrations",      // your app's migrations
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### Running both sets of migrations

```bash
# 1. Run cinnamon migrations (creates cinnamon.* tables)
cd cinnamon && bun run cinnamon:migrate && cd ..

# 2. Run your app migrations (creates public.* tables)
bunx drizzle-kit migrate
```

In Docker, add a second migrate service or chain the commands in your existing one:

```yaml
migrate:
  build: .
  command: >
    sh -c "cd cinnamon && bun run cinnamon:migrate && cd .. && bunx drizzle-kit migrate"
  depends_on:
    postgres:
      condition: service_healthy
```
