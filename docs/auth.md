# Dashboard Authentication

The dashboard is open by default for local development. To require Google sign-in, follow the steps below.

## Setup

1. Place your GCP OAuth `client_secret.json` in the project root, or set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`.

2. Generate a session secret and add it to `.env`:

```bash
bun run generate:secret
```

Paste the output as `SESSION_SECRET` in `.env`.

3. For local dev with `bun run dev` (Vite on port 5173), create `.env.local` with:

```
BASE_URL=http://localhost:5173
```

This ensures the OAuth callback and session cookie use the same origin. Keep `BASE_URL=http://localhost:3000` in `.env` for Docker/production. `.env.local` overrides `.env` when running locally and is gitignored.

4. Set super-admin emails (these users get full dashboard access on first login):

```
SUPER_ADMINS=you@gmail.com,teammate@gmail.com
```

5. Optionally enable access requests so non-admin users can request dashboard access:

```
ACCESS_REQUESTS_ENABLED=true
```

When `SESSION_SECRET` is unset, auth is disabled and the dashboard remains open.

## Environment variables

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | GCP OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | GCP OAuth client secret |
| `SESSION_SECRET` | Random secret for signing session JWTs |
| `BASE_URL` | Origin URL for OAuth callbacks (e.g. `http://localhost:3000`) |
| `SUPER_ADMINS` | Comma-separated emails that always have full access |
| `ACCESS_REQUESTS_ENABLED` | Set to `true` to enable self-service access requests |

See `.env.example` for all available options.

## Access requests

See [Access requests](access-requests.md) for the self-service access request flow and admin actions.
