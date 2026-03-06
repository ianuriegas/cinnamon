FROM oven/bun:1-alpine AS base
RUN apk add --no-cache python3
WORKDIR /app

FROM base AS install
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM base
COPY --from=install /app/node_modules ./node_modules
COPY . .
