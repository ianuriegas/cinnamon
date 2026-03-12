# Base: Bun + Python + uv (for Python jobs that use pyproject.toml)
FROM oven/bun:1-alpine AS base
ARG UV_VERSION=0.10.9
RUN apk add --no-cache python3 curl \
    && curl -LsSf https://astral.sh/uv/install.sh | sh -s -- -v ${UV_VERSION}
ENV PATH="/root/.local/bin:$PATH"
WORKDIR /app

# Production deps only
FROM base AS install
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Dashboard build
FROM base AS build-dashboard
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bunx vite build

# Final image
FROM base
COPY --from=install /app/node_modules ./node_modules
COPY . .
COPY --from=build-dashboard /app/dist/client ./dist/client
