# Migrations

Cinnamon uses [Drizzle ORM](https://orm.drizzle.team/) for schema definitions and migrations.

## Schema namespacing

All core tables live under a dedicated `cinnamon` Postgres schema rather than the default `public` schema. This prevents table name collisions if you share the same database with other applications.

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
```

Reset the local database (drops everything and re-applies all migrations):

```bash
bun run db:reset-local
```

Generate a new migration after schema changes:

```bash
bun run db:generate
```

## Custom tables (Docker mode)

Docker-mode projects can add their own tables without forking Cinnamon. The
migrate service runs two independent migration tracks:

1. **Core migrations** — baked into the image at `db/migrations/`, tracked by `drizzle.__drizzle_migrations`.
2. **Custom migrations** — volume-mounted from the user's `./db/migrations/` into `/app/db/custom-migrations`, tracked by `public.__drizzle_migrations_custom`.

The two journals are completely independent, so upgrading the Cinnamon image
never interferes with user migrations.

### Workflow

```bash
# 1. Define a schema in db/schema/
# 2. Generate a migration
bun run db:generate

# 3. Apply it (runs both core + custom)
bun run db:migrate

# 4. Undo a migration file before it's applied
bun run db:drop
```

Custom tables default to the `public` Postgres schema. You can reference
Cinnamon tables via foreign keys (e.g. `REFERENCES cinnamon.teams(id)`).

## Sharing a database with your own app

If your app has its own tables in the same Postgres instance, cinnamon's `cinnamon.*` schema won't conflict with your `public.*` tables. You can run both sets of migrations independently — they target different schemas.
