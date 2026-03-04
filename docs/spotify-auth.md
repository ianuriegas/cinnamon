# Spotify OAuth

Get a refresh token for auto-refreshing Spotify API access.

## Usage

```bash
bun run auth:spotify
```

## Prerequisites

In `.env`, set before running:

- `SPOTIFY_CLIENT_ID` — from your [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
- `SPOTIFY_CLIENT_SECRET` — from the same app
- Add `http://127.0.0.1:8888/callback` to **Redirect URIs** in the app settings

## What It Does

1. Opens your browser to the Spotify authorization page
2. Starts a local server to catch the callback
3. Exchanges the authorization code for tokens
4. Writes `SPOTIFY_REFRESH_TOKEN` to `.env`

The refresh token does not expire unless you revoke the app’s access. The job uses it to obtain short-lived access tokens automatically.
