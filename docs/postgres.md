# Postgres Quick Reference

## Health checks

```bash
docker compose ps postgres                                              # container status
docker compose exec postgres pg_isready -U cinnamon -d cinnamon         # readiness probe (expect "accepting connections")
docker compose logs -f postgres                                         # live logs
```

## SQL shell

```bash
docker compose exec postgres psql -U cinnamon -d cinnamon
```

Useful one-liners:

```bash
docker compose exec postgres psql -U cinnamon -d cinnamon -c "\dt"           # list tables
docker compose exec postgres psql -U cinnamon -d cinnamon -c "SELECT now();" # test query
```
