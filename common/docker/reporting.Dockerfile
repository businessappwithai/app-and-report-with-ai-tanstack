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

COPY . .
# `bun install`, not `bun install --frozen-lockfile`, and that is not a
# preference.
#
# `bun.lock` at enterprise_reporting_tanstack@main disagrees with the
# `package.json` beside it: the lock still carries `falkordb` and its subtree
# (`@js-temporal/polyfill`, `jsbi`, `generic-pool`), which the manifest no
# longer depends on. Bun refuses a frozen install against that — under 1.3.11
# and 1.3.14 alike, and in that repository's own Dockerfile as much as this
# one. A frozen install here would fail every build, not catch drift.
#
# Reproducibility does not rest on this line anyway: the orchestrator pins the
# commit each repository is built from (APP_REPO_REF / REPORT_REPO_REF), so a
# build names its sources exactly. Restore --frozen-lockfile the moment
# upstream regenerates the lock.
RUN bun install && bun pm cache rm

# The overlay, from the `common` build context declared in docker-compose.yml.
COPY --from=common build/subpath-overlay.ts /overlay/subpath-overlay.ts
ARG BASE_PATH=/report
RUN bun /overlay/subpath-overlay.ts --dir /app --base "${BASE_PATH}"

RUN bun run build

# ─── runtime ────────────────────────────────────────────────────────────────
FROM oven/bun:1.3-slim

WORKDIR /app

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

# The probe is bun rather than curl, and that is the reason there is no
# apt-get in this file at all. `oven/bun:1.3-slim` ships no curl, no
# ca-certificates and no psql, and the three lines that used to install them
# bought one healthcheck: nothing here shells out to psql — the `pg_isready`
# probes in docker-compose.yml run inside the postgres images, which have it —
# and bun carries its own root certificates, so the system store is unused.
# An apt layer is also the first thing to fail on a network that does not allow
# deb.debian.org, which is a poor way to lose a build that needs no packages.
#
# 127.0.0.1, never localhost: inside the container localhost also resolves to
# ::1, and the server listens on IPv4 only — the probe then reports "connection
# refused" against a server answering 200 to everyone else.
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=12 \
    CMD ["bun", "-e", "const r = await fetch('http://127.0.0.1:3000/api/health').catch(() => null); process.exit(r?.ok ? 0 : 1)"]

CMD ["bun", "server-static-wrapper.mjs"]
