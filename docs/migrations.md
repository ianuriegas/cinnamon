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

## Sharing a database with your own app

If your app has its own tables in the same Postgres instance, cinnamon's `cinnamon.*` schema won't conflict with your `public.*` tables. You can run both sets of migrations independently — they target different schemas.
