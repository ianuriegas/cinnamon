# Postgres Quick Reference

## Health checks

```bash
docker compose ps postgres                                              # container status
docker compose exec postgres pg_isready -U cinnamon -d cinnamon         # readiness probe (expect "accepting connections")
docker compose logs -f postgres                                         # live logs
```

## SQL shell

```bash
docker compose exec postgres psql -U cinnamon -d cinnamon
```

Useful one-liners:

```bash
docker compose exec postgres psql -U cinnamon -d cinnamon -c "\dt"           # list tables
docker compose exec postgres psql -U cinnamon -d cinnamon -c "SELECT now();" # test query
```

## Remote access via Tailscale

Docker Compose exposes Postgres on port 5432, and Tailscale makes the host reachable at its `100.x.y.z` IP. Connect from any machine on the Tailscale network with no tunnels or port forwarding.

### Beekeeper Studio / GUI client

| Setting  | Value                                          |
| -------- | ---------------------------------------------- |
| Host     | Tailscale IP of the target MacBook             |
| Port     | `5432`                                         |
| User     | `POSTGRES_USER` from the target's `.env`       |
| Password | `POSTGRES_PASSWORD` from the target's `.env`   |
| Database | `POSTGRES_DB` from the target's `.env`         |

### psql from another machine

```bash
psql postgresql://<user>:<password>@<tailscale-ip>:5432/<database>
```

### Useful queries

Recent job history:

```sql
SELECT id, job_name, status, error, started_at, finished_at
FROM jobs_log ORDER BY created_at DESC LIMIT 20;
```

Recent Spotify plays:

```sql
SELECT track_id, played_at, context_uri
FROM spotify_recently_played ORDER BY played_at DESC LIMIT 20;
```

Latest top tracks snapshot:

```sql
SELECT track_id, time_range, rank, snapshot_date
FROM spotify_top_tracks ORDER BY snapshot_date DESC, rank LIMIT 20;
```

## Remote job triggering

### Via HTTP API

The preferred way to trigger jobs remotely. Requires a valid API key (see `bun run scripts/seed-team.ts`):

```bash
curl -X POST http://<tailscale-ip>:3000/v1/enqueue \
  -H "Authorization: Bearer cin_<your_key>" \
  -H "Content-Type: application/json" \
  -d '{"jobName": "spotify-recently-played"}'
```

### Via SSH + Docker

SSH into the target MacBook and use `docker compose exec` to enqueue jobs on the running worker:

```bash
ssh <mac-user>@<tailscale-ip>

cd ~/deployments/cinnamon
docker compose exec worker bun run trigger spotify-recently-played
docker compose exec worker bun run trigger spotify-top-tracks
docker compose exec worker bun run trigger cinnamon 10
```

Or as a one-liner from your local machine:

```bash
ssh <mac-user>@<tailscale-ip> "cd ~/deployments/cinnamon && docker compose exec worker bun run trigger spotify-recently-played"
```

## Tables

| Table                       | Purpose                                   |
| --------------------------- | ----------------------------------------- |
| `teams`                     | Tenant/team registry                      |
| `api_keys`                  | Hashed API keys linked to teams           |
| `jobs_log`                  | Durable log of all processed jobs         |
| `spotify_recently_played`   | Deduplicated Spotify listen history       |
| `spotify_top_tracks`        | Daily top tracks snapshots by time range  |
