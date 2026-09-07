# The one-shot seeder.
#
# Runs after both databases are up and the generated application has migrated,
# then exits. It registers the application's database as a data source,
# introspects and caches its schema, and writes the reporting pack's queries,
# reports, charts and dashboards.
#
# Built from the reporting application's source rather than a bare bun image so
# that `seed-reporting.ts` can import through `@/` and use that project's own
# `getDb`, `encrypt` and `introspectAndCacheSchema`. A seeder with its own
# encryption or its own schema-cache shape would drift from the reader, and the
# failure would be a data source that exists and cannot be opened.

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

# Inside the app's own tree, so `@/` resolves through its tsconfig paths.
COPY --from=common seed/seed-reporting.ts ./src/seed-reporting.ts

ENV NODE_ENV=production \
    REPORTING_PACK=/pack/reporting-pack.json

CMD ["bun", "src/seed-reporting.ts"]
