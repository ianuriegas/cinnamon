# GitHub Actions deploy workflow (example)

Reference workflow for deploying cinnamon to a remote machine via SSH. This is **not** active — it lives in `examples/` as a template you can copy into your own `.github/workflows/`.

## Usage

Copy the workflow into your repo:

```bash
cp cinnamon/examples/deploy/github-actions/deploy.yml .github/workflows/deploy.yml
```

Then configure the required GitHub Secrets (see `deploy.yml` comments and [`deploy.md`](../deploy.md) for details).

## What it does

1. Triggers on push to `main` after checks pass.
2. Connects to the target machine over SSH (optionally through a VPN).
3. Pulls the latest code and runs `docker compose up -d --build`.

For full setup instructions, see [`deploy.md`](../deploy.md).
