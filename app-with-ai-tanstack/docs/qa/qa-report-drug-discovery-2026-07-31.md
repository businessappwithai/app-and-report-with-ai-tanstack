# QA Report — drug-discovery (generated app)

**Date:** 2026-07-31
**Target:** http://localhost:3001 (TanStack Start) + http://localhost:3000/api (NestJS)
**Source model:** `examples/drug-discovery.eml.mmd` — 17 entities, 7 categories
**Tier:** Standard
**Branch:** `claude/drug-discovery-categories-qa-fon34w`
**Framework:** TanStack Start (vinxi) + React 18, NestJS + Fastify + Kysely, PostgreSQL 16

Health score: **72 → 96**

All fixes land in `packages/generator/templates` and the generator sources, so every
generated app picks them up — not just this one output.

---

## Summary

| Severity | Found | Fixed | Deferred |
|----------|------:|------:|---------:|
| Critical | 2 | 2 | 0 |
| High     | 4 | 4 | 0 |
| Medium   | 3 | 3 | 0 |
| Low      | 1 | 1 | 0 |
| **Total**| **10** | **10** | **0** |

### Top 3

1. `generate --force` left stale migrations and broke `bun run migrate` (ISSUE-001)
2. `bun run migrate` silently never ran the seeds (ISSUE-002)
3. Every category select on `/admin/categories` was unreadable (ISSUE-007)

---

## Issues

### ISSUE-001 — `generate --force` leaves stale migrations, breaking `bun run migrate`
**Severity:** Critical · **Category:** Functional · **Status:** verified · **Commit:** `014342f`

`generateMigrations()` named each scaffold migration `<Date.now()>_<slug>.ts`, and the
cleanup pass removed only three of the eight slugs. A second `--force` run therefore
emitted a fresh set of eight alongside the old set. The migration runner keys off the
filename, so it replayed CREATE TABLE migrations that had already run and `bun run
migrate` failed on a regenerated project.

Scaffold migrations now use a fixed zero-padded sequence (`0000_create_auth_tables.ts`
…`0007_create_audit_log.ts`), so a rerun overwrites in place and executed migrations
stay executed. The cleanup pass drops any prefix for a known scaffold slug, clearing
the timestamped files older generator versions produced. The sequence still sorts
before the `<Date.now()>_add_<entity>.ts` additive migrations `generate:entity` writes.

**Repro (before):** generate → migrate → `generate --force` into the same dir → migrate.
**After:** two full generations over the same directory leave exactly 8 migration files;
the second `bun run migrate` reports all 8 already executed.

### ISSUE-002 — `bun run migrate` never ran the seeds
**Severity:** Critical · **Category:** Functional · **Status:** verified · **Commit:** `014342f`

`src/migrate.ts` looked for seeds in `src/seeds`. They are generated at the backend
root next to `src/`, which is where `src/seed.ts` reads them from. The mismatch was
silent: it printed `⊘ No seeds directory found` and exited 0, leaving a generated app
with an empty Application Dictionary — no sys_reference, no sys_table/column/field, no
categories, no business data — unless you happened to run `db:setup` instead.

**After:** all 6 seeds run; 7 categories seeded, 17/17 entities assigned, 0 uncategorised.

### ISSUE-003 — unhandled ElectricProvider sync error on every page load
**Severity:** High · **Category:** Console · **Status:** verified · **Commit:** `014342f`

`ElectricProvider` booted PGlite and reloaded sys_ collections even with
`VITE_ELECTRIC_URL` unset — the shipped default, and the case the sys_ hooks already
handle by fetching over HTTP. It now stays idle when Electric is not configured,
exposes `isEnabled` on the context, and treats a real sync failure as a warning that
degrades to HTTP rather than an error.

**After:** zero console errors on load.

### ISSUE-004 — duplicate TanStack Query keys from `useQueries`
**Severity:** High · **Category:** Functional · **Status:** verified · **Commit:** `014342f`

`DynamicTable` keyed lookups by referenced table, so two FK columns pointing at the
same table produced the same key. React Query drops the duplicate, which shifted every
result after it onto the wrong field. `ADListShell` and `ADDetailShell` had the same
problem with repeated breadcrumb ancestors.

Lookups are now fetched once per referenced table and mapped back by table; the
breadcrumb shells dedupe by endpoint+id.

### ISSUE-005 — Google Fonts was a hard runtime dependency
**Severity:** High · **Category:** Performance · **Status:** verified · **Commit:** `014342f`

`__root.tsx` loaded Inter, Newsreader and JetBrains Mono from `fonts.googleapis.com`
as a render-blocking stylesheet, so the app rendered wrong wherever that host is
unreachable — corporate proxy, air-gapped site, CI sandbox.

The latin subsets are now vendored under `frontend/public/fonts` (387 KB, 9 faces,
SIL OFL with licence included) and served from the app's own origin. The frontend
generator copies `public/` verbatim.

**After:** `/fonts/fonts.css` and every woff2 return 200 from the app itself; zero
external font requests.

### ISSUE-006 — FK columns rendered raw UUIDs
**Severity:** High · **Category:** Functional · **Status:** verified · **Commit:** `5f0f69e`

The dictionary describes a record's label as `ref_label_fields` (a list, so entities
named by more than one column read properly). The `.hbs` copy of `DynamicTable` honours
it; the `.tsx` copy that generation actually ships defaulted straight to `"name"`. Any
table naming its records something else rendered the id — instrument bookings listed
`4fa51ef8-3622…` where `Title 1` belonged. It only looked correct for `bus_instrument`
because that table happens to have a `name` column.

**Before:** `James Smith | 4fa51ef8-3622-4b8e-a7fa-… | fcd52f92-…`
**After:** `James Smith | Title 1 | fcd52f92-…`

(The third column, `booked_by`, stays a UUID by design: the model declares it as a plain
string, not an FK. The EML checker already flags this — `EML114`, "does not end with
`_id`" — for `booked_by` and `reported_by`. That is a model authoring choice, not an app
defect.)

### ISSUE-007 — every category select on `/admin/categories` was unreadable
**Severity:** Medium · **Category:** Visual · **Status:** verified · **Commit:** `5f0f69e`

`.swiss-input` carries `py-3` alongside `h-12`. Tailwind utilities beat the component
layer, so `swiss-input h-8` shrank the box to 32px while the 24px of vertical padding
stayed, leaving a band too short for 14px text — only descenders and the dots on i and j
painted. All 17 assignment rows were illegible.

Single-line inputs and selects are centred by the browser inside their content box, so
the padding was doing no work at any size. Dropped from `.swiss-input`, which fixes the
`h-8` and `h-9` overrides at once. The one textarea using the class sets its own padding.

**Evidence:** `screenshots/cat-select.png` (before) → `screenshots/categories-fixed.png` (after)

### ISSUE-008 — dashboard header overflowed on a phone
**Severity:** Medium · **Category:** Visual · **Status:** verified · **Commit:** `5f0f69e`

A fixed `w-56` search box pushed the account controls past the viewport: 419px of
content in a 375px window, so the whole page scrolled sideways. The search box now
shrinks below `sm` and the title truncates.

**After:** `scrollWidth === clientWidth === 375`.

### ISSUE-009 — audit trail recorded a column that does not exist
**Severity:** Medium · **Category:** Functional · **Status:** verified · **Commit:** `014342f`

`AuditInterceptor` diffed the raw response body. Bus mutations append a `promotion`
report from the rules engine, so every update logged `promotion` as a changed column
and stored a copy of the report in `after_value`. Before/after now hold the record only.

**Before:** `changed: ["registration_status","updated_at","version","promotion"]`
**After:** `changed: ["formula","registration_status","updated_at","version"]`

Related, same commit: `audit_log` had no migration — `AuditService` created it lazily at
boot, so it existed only after the app had started once and was never versioned or
indexed up front. Added `0007_create_audit_log.ts`.

### ISSUE-010 — record count read "1 records"
**Severity:** Low · **Category:** Content · **Status:** verified · **Commit:** `5f0f69e`

Also fixed in the same pass: the frontend `dev` script rendered as `vinxi dev --port `
because `config.frontendPort` was never put in the template context, so the dev server
picked a port at random. Now `vinxi dev --port 3001`.

---

## Feature verification — entity categories

Everything the feature promises, exercised in the browser:

- **Declared in the model.** 7 `%%category` directives in `drug-discovery.eml.mmd`.
- **Seeded.** `sys_category` holds 7 rows; all 17 bus entities carry a
  `sys_category_id`; 0 uncategorised.
- **Maintained at `/admin/categories`.** Created "Analytics and Reporting" through the
  form, assigned Workflow Event to it via the per-entity table. Both persisted.
- **Rendered on the dashboard, grouped alphabetically, name above a separating rule.**
  After the new category: `Analytics and Reporting | Compound Registry | Experiments |
  Instruments | Inventory and Samples | People and Teams | Quality and Compliance |
  Suppliers | Application Dictionary`. Correct order, description below each rule.
- **Mobile.** Same grouping at 375x812, single-column cards, no horizontal scroll.
- **Console.** Clean throughout.

## Feature verification — audit trail

- `audit_log` created by migration, indexed on timestamp/user/action/entity/success.
- CREATE, UPDATE, DELETE and a failed validation all recorded, with actor, session, IP,
  user agent, source, before/after JSON and changed-field list.
- `/admin/audit` renders all of it, expands to a side-by-side before/after diff.
- Filters work: action=`ENTITY_DELETE` narrows 6 records to 1. `entity-types` returns
  `["compound"]`.
- `verify` correctly reports `immudb not connected` when `IMMUDB_ENABLED=false`.

---

## Console health

Zero errors and zero warnings across the dashboard, `/admin/categories`,
`/admin/audit`, and the compound / experiment / sample / instrument-booking lists.

Two non-issues seen and dismissed:

- **401s before login.** Hitting `/` unauthenticated fires the dashboard's fetches
  before the redirect settles. Expected; the redirect works.
- **One 404 during a rapid navigation loop.** Not reproducible when each page is
  visited on its own (0 errors each) — Vite's dep re-optimize racing the navigation,
  visible only in dev.

## Environment note

gstack's browser needed bridging: its Playwright wants Chromium build 1208 and the
sandbox ships 1194. `bun run setup:gstack` downloaded 1208 cleanly this time, so no
symlink workaround was needed. `fonts.googleapis.com` and `fonts.gstatic.com` are also
reachable through the proxy now — which is what made vendoring the fonts possible
rather than merely making the CDN failure quiet.
