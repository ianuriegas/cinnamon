# Deployment

Automated deployment via GitHub Actions. Pushes to `main` that pass CI checks are deployed to the target MacBook over SSH through the Tailscale network.

## How it works

1. Push to `main` triggers the **Checks** workflow (lint, typecheck, test).
2. On success, the **Deploy** workflow starts automatically.
3. The GitHub Actions runner joins the Tailscale network with an ephemeral auth key.
4. Over SSH, it connects to the target MacBook, pulls the latest code, and runs `docker compose up -d --build`.
5. The `.env` file lives on the target MacBook and is not touched by the workflow.

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

### Docker build fails

SSH into the MacBook and check logs:

```bash
cd ~/deployments/cinnamon
docker compose logs --tail 50
```
