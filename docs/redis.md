# Redis Quick Reference

## Health checks

```bash
docker compose ps redis                          # container status
docker compose exec redis redis-cli ping         # expect "PONG"
docker compose logs -f redis                     # live logs
```

## Debugging commands

```bash
docker compose exec redis redis-cli KEYS '*'             # list all keys
docker compose exec redis redis-cli SET app:status "ok"  # set a key
docker compose exec redis redis-cli GET app:status       # get a key
```
