# Examples

Reference implementations and deployment templates. These are **not** part of core cinnamon -- they exist to show patterns you can follow in your own projects.

## Deploy templates

| Path | Purpose |
|------|---------|
| [`deploy/docker/`](deploy/docker/) | Docker Compose override example |
| [`deploy/github-actions/`](deploy/github-actions/) | Reference GitHub Actions deploy workflow (SSH-based) |
| [`deploy/kubernetes/`](deploy/kubernetes/) | Minimal K8s manifests (Deployment, Service, CronJob) -- preview |

## Spotify integration

A complete example of ingesting data from the Spotify Web API into Postgres using cinnamon jobs.

### What's included

| Path | Purpose |
|------|---------|
| `jobs/spotify/` | Job scripts for recently-played and top-tracks ingestion |
| `schema/` | Drizzle table definitions for Spotify data |
| `config/spotify.config.ts` | Job entries to add to your `cinnamon.config.ts` |
| `scripts/spotify-auth.ts` | Interactive OAuth flow to obtain a refresh token |
| `docs/` | Setup guides for Spotify OAuth and the recently-played job |
| `tests/` | Unit tests for the ingest logic |

### Setup

1. Follow `docs/spotify-auth.md` to get your `SPOTIFY_REFRESH_TOKEN`.
2. Add `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `SPOTIFY_REFRESH_TOKEN` to your `.env`.
3. Copy the job entries from `config/spotify.config.ts` into your `cinnamon.config.ts`.
4. Run the Spotify schema migration (the tables are defined in `schema/` — you'll need to add them to your Drizzle schema directory and regenerate migrations).

### Import paths

The job scripts use `@/` import aliases that resolve within the cinnamon monorepo. If you copy these files into a separate project, update the import paths to match your project's module resolution.
