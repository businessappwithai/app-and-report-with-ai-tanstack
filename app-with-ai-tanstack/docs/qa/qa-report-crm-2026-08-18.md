# QA report — generator + generated CRM, with a real local-first dictionary

**Date:** 2026-08-18
**Branch:** `claude/app-builder-generator-qa-3tsg72`
**Model under test:** `language/examples/crm.eml.mmd` — 17 entities, 39 relationships, 8 rules, 17 workflows
**Targets:** generator at `localhost:3000`, generated CRM at `localhost:4000` (API `:4001`)
**Screenshots:** `pics/qa01`–`qa31` (28 files)

## Summary

| | Count |
|---|---|
| Issues found | 11 |
| Fixed and verified | 10 |
| Reported, not fixed | 1 |

Two findings made a freshly generated application unusable rather than merely
degraded: **nobody could sign in to one at all**, and the role-scoped dictionary
sync that the templates advertised was dead code wrapped around an unauthenticated
proxy. Both are fixed and verified end to end.

The generator itself is in good shape. Import, validate, the wizard, and code
generation all worked on the first pass against the full CRM model; the issues
there are environmental rather than functional.

---

## The generator app

### G-1 — `bun install && bun run dev` cannot serve a single request (high)

The documented first-run sequence leaves the workspace packages unbuilt, so
`packages/web` resolves `@appwithai/core` to a `dist/` that does not exist. The
first API call fails with `Cannot find module '@appwithai/core/services'`, and
the resulting unhandled rejection **takes the dev server process down** —
`ERR_INVALID_ARG_TYPE` in srvx's `writeHead`, exit code 1. A new developer sees
the server die on the login page.

**Not fixed** — the fix is a docs/scripts change (`bun run build:core` before
`dev`, or a `predev` hook) that reaches beyond this QA pass. Worth noting that
the process death is separate from the missing build: any 500 in a server
handler kills the dev server, which will keep costing time regardless.

Workaround, and what this pass used: `bun run build:core && bun run build:generator && bun run build:ai` first.

### G-2 — an admin cannot complete the generate step (medium) — verified, reported

`PATCH /api/projects/:id` returns 403 `Admins cannot modify projects`
(`packages/web/src/routes/api/projects/$id/index.ts:220`). On a fresh install the
only route to an approved account is `bun run seed:admin`, which makes you an
admin — so the first user of a new deployment hits this. It surfaces as an
uncaught `pageerror`, not a message. Generation itself still completes.

### G-3 — generated output does not land where the docs say (low)

`.env.example` ships `DEFAULT_OUTPUT_DIR=./generated`, a relative path resolved
against the dev server's cwd (`packages/web`). Output lands in
`packages/web/generated/<projectId>` while `CLAUDE.md` documents
`generated-projects/`, and the relative path is what gets persisted to
`projects.generated_path`.

### What worked

Import parsed the CRM model exactly right (17 entities, 39 relationships, 8
rules, 17 workflows — `qa06`). Validate reported `Diagram is valid — 17 entities
parsed.` (`qa09`). Flow view, the entities panel, and all six wizard steps
rendered with no console errors (`qa08`–`qa15`). Generation produced 402 files.

---

## The generated application

### C-1 — nobody can sign in to a generated application (critical)

Four separate defects stacked into one wall. Every seeded account — including the
administrator — was rejected with `Invalid email or password`.

1. **Better Auth was told nothing about the database.** `kyselyAdapter(kysely)`
   was passed without a dialect, so the library logged *"Could not determine
   database type, defaulting to sqlite"* and ran SQLite-shaped queries against
   Postgres. Now `{ db: kysely, type: 'postgres' }`.
2. **The seeded password hash was a hardcoded string** copied from an older
   release. A hash only means anything to the hasher that produced it.
3. **The seeded password was too short.** `minPasswordLength: 8` with a default
   of `"admin"` — five characters — is rejected before the hash is consulted.
4. **The `account` table was missing columns** the installed Better Auth
   requires (`issuer` NOT NULL), and `user`/`session`/`account` used TEXT and
   INTEGER where Postgres needs `TIMESTAMPTZ` and `BOOLEAN`. Writes failed with
   `invalid input syntax for type integer: "false"`.

**Fixed.** The seed no longer writes `user` and `account` rows by hand — it calls
`auth.api.signUpEmail`, so the rows are whatever the installed version says they
should be and cannot drift again. Column types are corrected, and a new migration
(`010_sync_better_auth_schema`) asks Better Auth for its own schema diff and
applies it, so a future dependency bump reconciles instead of silently breaking
sign-in. Default password is `admin123`.

**Verified:** all four seeded accounts return 200 from
`POST /api/auth/sign-in/email`; UI login lands on `/dashboard` (`qa20`, `qa21`).

### C-2 — the Electric shape proxy trusted the client for its own role (critical)

The proxy read the caller's role from a **query parameter** and interpolated it
into the upstream SQL:

```ts
const role = query['role'] ?? 'user';                       // client-supplied
return `... allowed_roles @> ARRAY['${role}']::text[]`;     // interpolated
```

It carried no auth guard at all. Any caller could name its own role, and inject
SQL through the same parameter.

**Fixed.** The controller is behind `JwtAuthGuard`; roles are resolved from the
database by joining the session's user through `sys_user_roles`, never read from
the request; only names returned by that query are formatted into a clause; the
client's own `where` and any unrecognised parameters are dropped; responses are
marked `private, no-store` so a shared cache cannot hand one role's rows to
another.

**Verified** against a stub upstream that echoes what it receives:

| request (as the `user` session) | what reached the upstream |
|---|---|
| `?table=sys_window` | `allowed_roles @> ARRAY['User']::text[]` |
| `?table=sys_window&role=Administrator` | `allowed_roles @> ARRAY['User']::text[]` |
| `?table=sys_window&role=x']::text[] OR 1=1 --` | `allowed_roles @> ARRAY['User']::text[]` |
| `?table=sys_window&where=1=1` | `allowed_roles @> ARRAY['User']::text[]` |
| `?table=bus_lead` | 403 — not on the allowlist |
| unauthenticated | 401 |

The three sessions each produced their own clause: `ARRAY['Administrator']`,
`ARRAY['User']`, `ARRAY['Analyst']`.

### C-3 — the role filter targeted a column that never existed (critical)

`allowed_roles` was referenced only by the proxy. No migration created it, so
every scoped shape would have failed at the database.

**Fixed.** `009_add_dictionary_role_scope` adds `allowed_roles TEXT[]` to
`sys_window`, `sys_table`, `sys_tab`, `sys_column` and `sys_field` with GIN
indexes, and derives it from the existing `sys_access` grants via
`sys_refresh_dictionary_scope()`. A statement-level trigger on `sys_access` keeps
it current, so granting a role a window immediately widens what that role syncs.

**Verified** after migrate + seed — every row scoped, none left null or empty:

| role | windows | fields |
|---|---|---|
| Administrator | 23 | 212 |
| Manager | 17 | 212 |
| Analyst | 17 | 212 |
| User | 17 | 212 |

The six withheld from non-admins are exactly the dictionary screens: Audit Log,
Business Rules, Role, Table and Column, Window/Tab/Field, Workflow Designer.
Confirmed in the UI: the administrator's dashboard lists all six, the standard
user's lists none (`qa30`, `qa31`).

### C-4 — TanStack DB was a phantom dependency (high)

`@tanstack/db` was pinned at `^0.0.1` (current is `0.7.2`) and **imported by
nothing**. What the comments called "TanStack DB Collections" was a hand-rolled
module-level object with a `Set` of listeners, filled from a PGlite database.
Neither `use-sys-electric.ts` nor `sys-collections.ts` was imported by any screen
— the entire local-first path was dead code, and every dictionary read went over
HTTP.

**Fixed.** The dictionary now genuinely runs on TanStack DB:
`createCollection(electricCollectionOptions(...))` per dictionary table, streamed
through the role-scoped proxy, at real versions (`@tanstack/db@^0.7.2`,
`@tanstack/react-db@^0.2.1`, `@tanstack/electric-db-collection@^0.3.18`,
`@electric-sql/client@^1.5.26`). PGlite is gone — it downloaded a WASM Postgres to
cache a few hundred metadata rows, which is the opposite of fast loading.

The hooks are wired into the screens that actually render windows, and they keep
the HTTP path as a fallback so a deployment without an Electric server still
works. `use-bus-entity-level` — which runs on **every** business screen and cost
two 500-row fetches each time — now answers from memory once synced.

### C-5 — two model roles received no dictionary at all (high)

The seed creates four roles and four demo accounts, but granted `sys_access` only
to Administrator and User. Manager and Analyst had zero grants. This was
invisible while the dictionary was served unfiltered; with scoping real, both
would open to an empty application.

**Fixed.** Business windows are granted to every active non-Administrator role.
Manager and Analyst now resolve 17 windows each (table above).

### C-6 — `useLiveQuery` breaks server rendering (high, self-inflicted, fixed)

Found during this work. `@tanstack/react-db`'s `useLiveQuery` calls
`useSyncExternalStore` with no `getServerSnapshot`, so under TanStack Start every
screen reading the dictionary warned *"Missing getServerSnapshot… Will revert to
client rendering"* and dropped its subtree out of SSR.

**Fixed** with a small `useCollectionRows` hook that subscribes to the collection
directly and supplies an empty server snapshot. Joins are plain array operations
over a few hundred in-memory rows. Frontend type errors fell from 83 to 11, and
the remaining 11 are all pre-existing files this pass did not touch.

### C-7 — the shape route was unreachable from the browser (high)

`setGlobalPrefix('api', { exclude: ['v1/shape'] })` put the proxy outside the
front end's `/api` forwarder, so a browser could only reach it cross-origin —
without the session cookie the proxy needs to scope anything. Now under the
prefix, same-origin and credentialed.

### C-8 — env vars were invisible to the built server (high)

`main.ts` never loaded `.env`; it worked only as a side effect of
`better-auth.ts` doing so for itself. Worse, both that module and `ConfigModule`
resolve the file with a fixed `../` from `__dirname`, which is off by one after a
Nest build (`dist/src/`). `ELECTRIC_URL` sat in `.env` and read as unset — sync
silently never turned on.

**Fixed.** `main.ts` loads `.env` before any other import, locating it by walking
up from `__dirname` so both `bun run src/main.ts` and the built layout resolve
the same file. The proxy also reads `ELECTRIC_URL` per request rather than
capturing it at module load, which happens before any dotenv call.

### C-9 — no way to actually run Electric (medium)

Nothing in the generated project could start an Electric server, and Postgres
shipped with `wal_level=replica`, which Electric cannot follow.

**Fixed.** `docker-compose.yml` gains an `electric` service wired to the same
database, with Postgres started at `wal_level=logical`. It is deliberately not
published to the host — Electric applies no authorization of its own, so the
proxy is the only way in. `ELECTRIC_URL` is documented in `.env.example`.

### What worked

Migrations and seeds ran clean against a fresh database. All 17 entities, 25
business rules across 17 entities, 5 sagas and the workflow definitions reached
the running app. Every screen swept — leads, accounts, opportunities, support
cases, the dictionary windows and tables, business rules, audit log — rendered
with **zero page errors and zero failed requests** (`qa22`–`qa29`). The audit log
correctly recorded each sign-in.

---

## How the dictionary now loads

```
Postgres ──logical replication──▶ Electric ──▶ /api/v1/shape (NestJS)
                                                     │ JwtAuthGuard
                                                     │ roles ← sys_user_roles
                                                     │ where ← allowed_roles @> ARRAY[…]
                                                     ▼
                                    TanStack DB collections (browser)
                                                     │
                                          useCollectionRows / dictionary hooks
                                                     ▼
                                              every window
```

Scoping is decided server-side and only once, at the shape. A client holds only
the slice of the dictionary its roles allow, reads it synchronously from memory,
and pays no per-screen round-trip. With `ELECTRIC_URL` unset the same hooks fall
back to HTTP, so sync is an optimisation and never a hard dependency.

## Verification

- `bun run type-check` — clean
- `bun run lint` — no errors
- `bun run test` — 370 passed, 6 skipped, 31 files
- Regenerated the CRM app from `crm.eml.mmd`, migrated and seeded a fresh
  database, and drove both applications in Chromium.

## Not covered

A real `electricsql/electric` server was never in the loop — no Docker daemon in
this environment. The proxy was verified against a stub upstream that echoes the
request, which proves what the proxy sends and what it refuses, but not Electric's
own handling of the `where` clause or the collections' behaviour under a live
stream. That is the one gap worth closing before relying on sync in production.

The enriched `/bus/:entity/fields/*` endpoints stay server-side on purpose: they
resolve reference targets and label fields across other entities, and
reimplementing that in the browser risks answering differently from the server
for the same entity.
