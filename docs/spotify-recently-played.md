# Spotify Recently Played Ingestion

Use Spotify's "Get Recently Played Tracks" endpoint to incrementally ingest listening history into your database.

## Implemented Job In This Repo

- Queue job name: `spotify-recently-played`
- Worker handler: `jobs/spotify-recently-played.ts`
- Destination table: `spotify_recently_played`
- Unique constraint: `(user_id, played_at)`
- JSONB payload columns:
  - `track_raw`: full Spotify `track` object
  - `context_raw`: full Spotify `context` object
  - `raw`: full play item (`track`, `played_at`, `context`)

Trigger examples:

```bash
# write mode
bun run trigger spotify-recently-played

# dry-run mode (fetch and validate only)
bun run trigger spotify-recently-played '{"dryRun":true}'
```

Optional payload fields:

- `spotifyUserId`: skip `/v1/me` lookup and ingest directly for a known user id.
- `afterMs`: manually override the cursor for one run.
- `dryRun`: when `true`, do not insert rows.

## Authentication Configuration

The job needs a Spotify access token and supports two modes:

1. Static token:
   - Set `SPOTIFY_ACCESS_TOKEN`.
2. Auto-refresh token:
   - Set `SPOTIFY_CLIENT_ID`
   - Set `SPOTIFY_CLIENT_SECRET`
   - Set `SPOTIFY_REFRESH_TOKEN`

If neither mode is configured, the job fails before ingestion starts.

## Endpoint and Scope

- Method: `GET`
- URL: `https://api.spotify.com/v1/me/player/recently-played`
- Required OAuth scope: `user-read-recently-played`

## Request Parameters

For cron-based ingestion, always use the max page size and incremental cursoring.

- `limit` (integer): maximum is `50`; set to `50` on every run.
- `after` (unix timestamp in milliseconds): returns tracks played after this time.
- `before` (unix timestamp in milliseconds): returns tracks played before this time.

Recommended approach:

1. Store the most recent `played_at` value you have successfully persisted.
2. Convert it to unix milliseconds.
3. Send it in the next request as `after`.

This avoids repeatedly re-fetching old plays and reduces duplicate writes.

In this repo, the job does this automatically by reading the latest stored `played_at` for the user when `afterMs` is not provided.

## Response Fields To Persist

From each play history item, store at least:

- `track.id`: unique Spotify track identifier.
- `played_at`: ISO 8601 playback timestamp (for example `2026-02-14T15:30:00Z`).
- `context.uri`: source context (playlist, album, artist radio, etc.).

## Database Dedupe Strategy

Use an upsert path with a uniqueness constraint:

- Unique key: `(user_id, played_at)`

Reason:

- If cron windows overlap, the same play can appear in consecutive responses.
- The unique key prevents double-counting and keeps ingestion idempotent.

## Cron Cadence

Target cadence is every 30 minutes.

There is currently no built-in scheduler in this repo for this job. Use external automation (for example platform cron, Kubernetes CronJob, or another scheduler) to enqueue `spotify-recently-played`. A native in-repo cron/repeat setup is planned for later.

In each run:

1. Call `/me/player/recently-played?limit=50` (plus `after` when available).
2. Upsert every item into your database.
3. On the next run, derive `after` from the latest stored `played_at` for that user (unless `afterMs` is explicitly provided).

## Important Capacity Note

If a user listens heavily (for example 8+ hours per day), `50` tracks can represent only around 3 hours of playback.

If ingestion runs once daily, earlier listens can be permanently missed due to endpoint limits. A 30-minute cron schedule is strongly recommended.
