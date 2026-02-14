# Redis Quick Checks

Use this when you want to confirm Redis is running and accepting commands.

## Start service

```bash
docker compose up -d redis
```

## Basic health checks

### 1) Check container status

```bash
docker compose ps redis
```

### 2) Ping Redis

```bash
docker compose exec redis redis-cli ping
```

Expected result:

```text
PONG
```

### 3) Inspect logs

```bash
docker compose logs -f redis
```

## Basic command examples

### Set and get a key

```bash
docker compose exec redis redis-cli SET app:status "ok"
docker compose exec redis redis-cli GET app:status
```

### List keys (for quick debugging)

```bash
docker compose exec redis redis-cli KEYS '*'
```

## Local URL in this project

From `.env.example`:

```text
REDIS_URL=redis://localhost:6379
```

If you have `redis-cli` installed locally, you can also run:

```bash
redis-cli -u redis://localhost:6379 ping
```
