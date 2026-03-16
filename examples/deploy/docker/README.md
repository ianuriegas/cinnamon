# Docker Compose override example

Use Docker Compose's merge feature to layer project-specific configuration on top of cinnamon's base services.

## Usage

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d
```

This merges both files. Cinnamon provides the infrastructure (Postgres, Redis, worker, scheduler, API server, migration runner). Your override adds project-specific configuration.

## What to customize

- **Environment variables** -- add your app's secrets to the worker/api services.
- **Migrations** -- chain your app's migrations after cinnamon's in the migrate service.
- **Extra services** -- add your own containers alongside cinnamon.
- **Ports** -- change the API port if 3000 conflicts with your app.
- **Volumes** -- mount project-specific files into containers.
