# Redis Quick Reference

## Health checks

Container status:

```bash
docker compose ps redis
```

Readiness check (expect "PONG"):

```bash
docker compose exec redis redis-cli ping
```

Live logs:

```bash
docker compose logs -f redis
```

## Debugging commands

List all keys:

```bash
docker compose exec redis redis-cli KEYS '*'
```

Set a key:

```bash
docker compose exec redis redis-cli SET app:status "ok"
```

Get a key:

```bash
docker compose exec redis redis-cli GET app:status
```
