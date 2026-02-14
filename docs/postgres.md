# Postgres Quick Checks

Use this when you want to confirm Postgres is up and queryable.

## Start service

```bash
docker compose up -d postgres
```

## Basic health checks

### 1) Check container status

```bash
docker compose ps postgres
```

### 2) Check readiness from inside container

```bash
docker compose exec postgres pg_isready -U cinnamon -d cinnamon
```

Expected result:

```text
accepting connections
```

### 3) Inspect logs

```bash
docker compose logs -f postgres
```

## Basic query examples

### Open a SQL shell

```bash
docker compose exec postgres psql -U cinnamon -d cinnamon
```

### Run one-off query

```bash
docker compose exec postgres psql -U cinnamon -d cinnamon -c "SELECT now();"
```

### List tables

```bash
docker compose exec postgres psql -U cinnamon -d cinnamon -c "\dt"
```

## Local URL in this project

From `.env.example`:

```text
DATABASE_URL=postgresql://cinnamon:change-me@localhost:5432/cinnamon
```

If you have `psql` installed locally, you can run:

```bash
psql "postgresql://cinnamon:change-me@localhost:5432/cinnamon" -c "SELECT 1;"
```
