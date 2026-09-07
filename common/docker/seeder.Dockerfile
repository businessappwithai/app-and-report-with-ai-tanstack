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

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock tsconfig.json ./
RUN bun install --frozen-lockfile && bun pm cache rm

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
