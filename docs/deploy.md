# Deployment

Automated deployment via GitHub Actions. Pushes to `main` that pass CI checks are deployed to the target MacBook over SSH through the Tailscale network.

## How it works

1. Push to `main` triggers the **Checks** workflow (lint, typecheck, dashboard build, test).
2. On success, the **Deploy** workflow starts automatically.
3. The GitHub Actions runner joins the Tailscale network with an ephemeral auth key.
4. Over SSH, it connects to the target MacBook, pulls the latest code, and runs `docker compose up -d --build`.
5. Docker Compose builds the dashboard, starts Postgres, Redis, runs migrations, and launches the API server (with dashboard at port 3000), worker, and scheduler.
6. The `.env` file lives on the target MacBook and is not touched by the workflow.

## How credentials work

There are two layers of configuration, and they intentionally overlap:

### Layer 1: `.env` file (app secrets)

The `.env` file on the target MacBook holds all secrets and app-level config (Spotify keys, webhook URLs, Postgres credentials). It is loaded into every app service via `env_file: .env` in `docker-compose.yml`. The `DATABASE_URL` and `REDIS_URL` values in `.env` point at `localhost` for local development outside Docker.

### Layer 2: `docker-compose.yml` environment overrides (infra URLs)

Inside Docker, the app services need to reach Postgres and Redis by their Docker service names (`postgres`, `redis`) instead of `localhost`. The compose file defines these URLs once in an `x-app-env` YAML anchor and merges them into every app service's `environment:` block. These overrides take precedence over the values from `.env`.

**In short:** `.env` provides secrets, and Docker Compose overrides the two infra URLs so they resolve inside the Docker network. You never need to manually change `DATABASE_URL` or `REDIS_URL` when switching between local dev and Docker — the compose file handles it.

## Prerequisites (one-time setup)

### Target MacBook

1. **Tailscale**: Install and connect with `--accept-routes`:

   ```bash
   tailscale up --accept-routes
   ```

2. **Remote Login**: Enable SSH access in **System Settings > General > Sharing > Remote Login**.

3. **OrbStack**: Ensure [OrbStack](https://orbstack.dev) is installed and running.

4. **Clone the repo** using SSH (required for non-interactive `git pull` during deploys):

   ```bash
   git clone git@github.com:ianuriegas/cinnamon.git ~/deployments/cinnamon
   ```

   If already cloned via HTTPS, switch the remote:

   ```bash
   cd ~/deployments/cinnamon
   git remote set-url origin git@github.com:ianuriegas/cinnamon.git
   ```

5. **Create `.env`** on the target MacBook at `~/deployments/cinnamon/.env` with your production values (see `.env.example` for the template). This file is managed manually on the target machine.

### SSH key

Generate a **deploy-only** ed25519 key pair on a trusted machine and copy the public key to the target MacBook:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/deploy_ed25519
ssh-copy-id -i ~/.ssh/deploy_ed25519.pub <mac-user>@<tailscale-ip>
```

The **private key** (`deploy_ed25519`) will be stored as a GitHub Secret. The public key stays in `~/.ssh/authorized_keys` on the target MacBook.

### GitHub Secrets

Add these secrets to your repo (Settings > Secrets and variables > Actions):

| Secret           | Value                                                        |
| ---------------- | ------------------------------------------------------------ |
| `TS_AUTHKEY`     | Tailscale auth key (ephemeral + reusable, from [admin console](https://login.tailscale.com/admin/settings/keys)) |
| `DEPLOY_SSH_KEY` | Contents of the ed25519 **private key** file                 |
| `MAC_USER`       | macOS username on the target MacBook                         |
| `MAC_IP`         | Tailscale IP of the target MacBook (e.g. `100.x.y.z`)       |

## Manual deploy

Trigger a deploy without pushing code:

```bash
gh workflow run deploy
```

## Code vs state: what rebuilds don't touch

Docker rebuilds replace **code** (images) but not **state** (data in Redis and Postgres volumes). This distinction matters:

| What changed | What to do |
| --- | --- |
| Source code, dependencies, dashboard | `docker compose up -d --build` (normal deploy) |
| Cron schedules added/removed | Rebuild + the scheduler auto-reconciles on startup |
| Need to wipe stale schedules from Redis | `docker compose restart scheduler` |
| Need to wipe all data (nuclear) | `docker compose down -v && docker compose up -d --build` |

The deploy workflow uses `--force-recreate` to ensure all containers (including the one-shot scheduler) restart with fresh code after every deploy. This guarantees schedule reconciliation runs on every deploy.

## Troubleshooting

### Deploy workflow didn't trigger

The deploy workflow triggers on push to `main` and manual `workflow_dispatch`. Check:

- The push was to `main` (not a feature branch).
- The workflow file exists on `main`.

### SSH connection refused

- Verify Remote Login is enabled: **System Settings > General > Sharing > Remote Login**.
- Confirm the Tailscale IP in GitHub Secrets matches `tailscale ip -4` on the MacBook.
- Check that the MacBook is online and connected to Tailscale: `tailscale status`.
- Test SSH manually: `ssh <mac-user>@<tailscale-ip>`.

### Migration fails with "password authentication failed"

Postgres only sets credentials when the data volume is first created. If you change `POSTGRES_PASSWORD` in `.env` after the volume already exists, Postgres keeps the old password and migrations will fail with `28P01`.

Fix by destroying and re-creating the volumes:

```bash
docker compose down -v
docker compose up -d
```

> **Warning:** `-v` deletes all data in Postgres and Redis. This is fine for local dev but should never be used in production without a backup.

### Docker build uses stale code

The Dockerfile builds the dashboard in a separate stage and copies it into the final image **after** `COPY . .` so the built assets always win. The `.dockerignore` also excludes `dist/` to prevent a stale local build from being sent into the build context. If you still see old code, force a clean rebuild:

```bash
docker compose up -d --build --no-cache
```

### Docker build fails

SSH into the MacBook and check logs:

```bash
cd ~/deployments/cinnamon
docker compose logs --tail 50
```
