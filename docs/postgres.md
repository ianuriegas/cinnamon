# Postgres Quick Reference

## Health checks

Container status:

```bash
docker compose ps postgres
```

Readiness probe (expect "accepting connections"):

```bash
docker compose exec postgres pg_isready -U cinnamon -d cinnamon
```

Live logs:

```bash
docker compose logs -f postgres
```

## SQL shell

```bash
docker compose exec postgres psql -U cinnamon -d cinnamon
```

List tables:

```bash
docker compose exec postgres psql -U cinnamon -d cinnamon -c "\dt"
```

Test query:

```bash
docker compose exec postgres psql -U cinnamon -d cinnamon -c "SELECT now();"
```

## Remote access

Docker Compose exposes Postgres on port 5432. If the host is reachable over a VPN or network, you can connect directly.

### GUI client (Beekeeper Studio, pgAdmin, etc.)

| Setting  | Value                                          |
| -------- | ---------------------------------------------- |
| Host     | IP or hostname of the target machine           |
| Port     | `5432`                                         |
| User     | `POSTGRES_USER` from the target's `.env`       |
| Password | `POSTGRES_PASSWORD` from the target's `.env`   |
| Database | `POSTGRES_DB` from the target's `.env`         |

### psql from another machine

```bash
psql postgresql://<user>:<password>@<host>:5432/<database>
```

### Useful queries

Recent job history:

```sql
SELECT id, job_name, status, error, started_at, finished_at
FROM cinnamon.jobs_log ORDER BY created_at DESC LIMIT 20;
```

## Remote job triggering

### Via HTTP API

The preferred way to trigger jobs remotely. Requires a valid API key (see `bun run scripts/seed-team.ts`):

```bash
curl -X POST http://<tailscale-ip>:3000/v1/enqueue \
  -H "Authorization: Bearer cin_<your_key>" \
  -H "Content-Type: application/json" \
  -d '{"jobName": "hello-world"}'
```

### Via SSH + Docker

SSH into the target machine and use `docker compose exec` to enqueue jobs on the running worker:

```bash
ssh <mac-user>@<tailscale-ip>

cd ~/deployments/cinnamon
docker compose exec worker bun run trigger hello-world
docker compose exec worker bun run trigger cinnamon 10
```

Or as a one-liner from your local machine:

```bash
ssh <mac-user>@<tailscale-ip> "cd ~/deployments/cinnamon && docker compose exec worker bun run trigger hello-world"
```

## Tables

All core tables live in the `cinnamon` Postgres schema (not `public`). See [Migrations](migrations.md) for details.

| Table                       | Purpose                                   |
| --------------------------- | ----------------------------------------- |
| `cinnamon.teams`            | Tenant/team registry                      |
| `cinnamon.api_keys`         | Hashed API keys linked to teams           |
| `cinnamon.jobs_log`         | Durable log of all processed jobs         |
| `cinnamon.users`            | Dashboard users (Google OAuth)            |
| `cinnamon.user_teams`       | User-to-team assignments                  |
| `cinnamon.access_requests`  | Pending/approved/denied access requests   |
