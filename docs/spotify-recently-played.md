# Spotify Recently Played Ingestion

Incrementally ingest listening history from Spotify's "Get Recently Played Tracks" endpoint.

## Job Reference

- Queue job name: `spotify-recently-played`
- Handler: `jobs/spotify/recently-played/ingest.ts`
- Destination table: `spotify_recently_played`
- Unique constraint: `(user_id, played_at)`
- Schedule: every hour (via `src/scheduler.ts`)

## Usage

Write mode:

```bash
bun run trigger spotify-recently-played
```

Dry-run (fetch only, no database writes):

```bash
bun run trigger spotify-recently-played '{"dryRun":true}'
```

Optional payload fields:

| Field | Description |
|-------|-------------|
| `spotifyUserId` | Skip `/v1/me` lookup and ingest for a known user id |
| `afterMs` | Override the cursor timestamp for one run |
| `dryRun` | When `true`, fetch and validate without inserting |

## Authentication

Requires one of two modes (see [Spotify OAuth](spotify-auth.md) for setup):

1. **Static token** -- set `SPOTIFY_ACCESS_TOKEN`
2. **Auto-refresh** -- set `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN`

## API Details

- `GET https://api.spotify.com/v1/me/player/recently-played`
- Scope: `user-read-recently-played`
- Always requests `limit=50` (max page size)
- Uses `after` cursor derived from the latest stored `played_at` for the user, unless `afterMs` is provided

## Dedupe Strategy

Upsert on `(user_id, played_at)`. Overlapping cron windows may return the same play twice; the unique key keeps ingestion idempotent.

## Capacity Note

Spotify returns at most 50 tracks per request, covering roughly 3 hours of playback. A 30-minute schedule avoids gaps for heavy listeners (8+ hours/day). Running less frequently risks permanently missing plays.
