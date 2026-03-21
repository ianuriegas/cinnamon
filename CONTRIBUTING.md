# Contributing

Thanks for your interest in contributing to cinnamon!

## Development setup

Clone the repo and install dependencies:

```bash
git clone https://github.com/ianuriegas/cinnamon.git
cd cinnamon
bun install
cp .env.example .env
```

Start Postgres and Redis:

```bash
docker compose up -d postgres redis
```

Run migrations and seed a team:

```bash
bun run db:migrate
bun run seed:team
```

Start the worker and dev server:

```bash
bun run dev
```

## Checks

Before submitting a PR, make sure all checks pass:

```bash
bun test
bun run typecheck
bun run lint
```

## Project structure

See [docs/project-structure.md](docs/project-structure.md) for the full directory layout and script reference.
