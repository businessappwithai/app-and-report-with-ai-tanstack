# The reporting application, built to live under /report.
#
# Its own Dockerfile is checked in next door and is left exactly as it is: this
# one builds the same source with two differences that only matter when the app
# shares an origin with another.
#
#   1. `common/build/subpath-overlay.ts` is run over the source before the
#      build, setting the bundler's `base`, the router's `basepath` and the
#      static wrapper's file lookup to /report. See that file for why all three
#      are needed and why the proxy in front does not strip the prefix.
#   2. The seeder's dependencies — `src/lib/sql` and `src/lib/mastra` — are
#      carried into the runtime image. The upstream image ships only `src/lib/db`
#      and `src/lib/security`, which is right for serving and one directory short
#      of introspecting a data source.
#
# The overlay writes into the build container's copy. Nothing under
# enterprise_reporting_tanstack/ is modified.

# syntax=docker/dockerfile:1.7
FROM oven/bun:1.3 AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY . .
RUN bun install --frozen-lockfile && bun pm cache rm

# The overlay, from the `common` build context declared in docker-compose.yml.
COPY --from=common build/subpath-overlay.ts /overlay/subpath-overlay.ts
ARG BASE_PATH=/report
RUN bun /overlay/subpath-overlay.ts --dir /app --base "${BASE_PATH}"

RUN bun run build

# ─── runtime ────────────────────────────────────────────────────────────────
FROM oven/bun:1.3-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# The patched wrapper, not the original: it is the copy that knows the prefix.
COPY --from=builder /app/server-static-wrapper.mjs ./server-static-wrapper.mjs

# Enough of src/ for the seeder to use this project's own encryption, schema
# introspection and cache shape rather than a second implementation of each.
COPY --from=builder /app/src/lib/db ./src/lib/db
COPY --from=builder /app/src/lib/security ./src/lib/security
COPY --from=builder /app/src/lib/sql ./src/lib/sql
COPY --from=builder /app/src/lib/mastra ./src/lib/mastra
COPY --from=builder /app/src/types ./src/types

EXPOSE 3000

ENV NODE_ENV=production \
    PORT=3000 \
    PUBLIC_DIR=/app/dist/client

# 127.0.0.1, never localhost: inside the container localhost also resolves to
# ::1, and the server listens on IPv4 only — the probe then reports "connection
# refused" against a server answering 200 to everyone else.
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=12 \
    CMD curl -f http://127.0.0.1:3000/api/health || exit 1

CMD ["bun", "server-static-wrapper.mjs"]
