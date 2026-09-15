# The one-shot seeder.
#
# Runs after both databases are up and the generated application has migrated,
# then exits. It registers the application's database as a data source,
# introspects and caches its schema, and writes the reporting pack's queries,
# reports, charts, dashboards and reporting roles.
#
# **The script is the reporting platform's own** —
# `scripts/seed-reporting-pack.ts`, checked in there. It used to live here, at
# `common/seed/seed-reporting.ts`, and be copied into that project's tree at
# build time so it could import through `@/`. That was the right dependency in
# the wrong direction: it needs that project's real `getDb`, `encrypt` and
# `introspectAndCacheSchema` — a seeder with its own encryption or its own
# schema-cache shape drifts from the reader, and the failure is a data source
# that exists and cannot be opened — and it writes eleven of that schema's
# tables, so it belongs beside them.
#
# It moved because a third caller appeared: a generated application's own
# `docker-compose.yml` now brings the platform up alongside it, and a copy of an
# 800-line seeder in the code generator's templates would have been the third
# implementation of the same writes. This file no longer carries a copy at all,
# which is why there is no `--from=common` here any more.

# syntax=docker/dockerfile:1.7
FROM oven/bun:1.3

WORKDIR /app

COPY package.json bun.lock tsconfig.json ./
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

COPY src/lib/db ./src/lib/db
COPY src/lib/security ./src/lib/security
COPY src/lib/sql ./src/lib/sql
COPY src/lib/mastra ./src/lib/mastra
COPY src/types ./src/types

# The seeder itself, from the reporting application's own tree.
COPY scripts/seed-reporting-pack.ts ./scripts/seed-reporting-pack.ts

ENV NODE_ENV=production \
    REPORTING_PACK=/pack/reporting-pack.json

CMD ["bun", "scripts/seed-reporting-pack.ts"]
