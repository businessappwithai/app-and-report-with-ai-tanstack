# QA Report — drug-discovery (generator + generated app)

**Date:** 2026-08-13
**Target:** generator (`packages/generator`) + a fresh `tanstackjs-nestjs` app generated from it
**Source model:** `examples/drug-discovery.eml.mmd` — 17 entities, 7 categories
**Branch:** `claude/drug-discovery-generator-qa-j3sd31`
**Framework:** TanStack Start (vinxi) + React 19, NestJS + Fastify + Kysely, PostgreSQL 16

All fixes land in `packages/generator/templates` and `packages/generator/src`, so
every generated app picks them up — not just this one output. This is a follow-up
pass to `qa-report-drug-discovery-2026-07-31.md` (already merged to `main`); none
of that report's 10 issues had regressed, this pass found 5 new ones.

---

## Summary

| Severity | Found | Fixed | Deferred |
|----------|------:|------:|---------:|
| Critical | 1     | 1     | 0        |
| High     | 3     | 3     | 0        |
| Medium   | 1     | 1     | 0        |
| **Total**| **5** | **5** | **0**    |

### Top 3

1. Fixing a broken `biome.json` let the generator's own auto-fix lint pass run
   for the first time — and it immediately broke NestJS dependency injection
   app-wide (ISSUE-005, critical).
2. FK columns resolved to a real label on the list view but showed a raw UUID
   on the record detail/edit view for the same field (ISSUE-002).
3. Seed data was actively misleading, not just bland: lab instruments,
   teams and vendors were seeded with fake human names (ISSUE-003).

---

## Method

1. Generated a fresh app from `examples/drug-discovery.eml.mmd`:
   `bun run generate:tanstack -- -i examples/drug-discovery.eml.mmd -o generated-projects/drug-discovery-clone -n drug-discovery-clone`
2. Ran the generator's own migration + seed pipeline against a local Postgres 16.
3. Booted the generated NestJS backend (`:4001`) and TanStack Start frontend
   (`:4000`) and drove them with gstack's headless browser (`/qa`): dashboard,
   entity list/detail/edit views, mobile viewport, console health.
4. Every fix below was applied to the generator source, then verified by a
   **full clean regeneration** — dropped database, deleted output directory,
   regenerated from scratch, rebooted both servers, re-tested in the browser —
   not just patched in the already-running output.

---

## Issues

### ISSUE-001 — `seedValue` fallback rendered identical placeholder text across unrelated columns
**Severity:** Medium · **Category:** Content · **Status:** verified · **Commit:** `aafb4a8`

Every string field outside a small hardcoded school/CRM vocabulary
(`email`, `name`, `gender`, `status`, `subject`, …) fell back to the exact
literal `` `Sample ${i + 1}` ``, regardless of field name. On the
drug-discovery model, `Compound.smiles`, `.inchi_key`, `.formula`,
`.compound_class` and `.registration_status` all read "Sample 1" on row 1 —
five different columns showing identical text, with nothing to tell them
apart.

**Before:** `Sample 1 | Sample 1 | Sample 1 | Sample 1 | Sample 1`
**After:** `Smiles 1 | Inchi Key 1 | Formula 1 | Compound Class 1 | Registration Status 1`

Fixed by folding the field name into the fallback (`packages/generator/src/templates/loader.ts`,
the `seedValue` Handlebars helper).

### ISSUE-002 — FK fields rendered raw UUIDs on the record detail/edit view
**Severity:** High · **Category:** Functional · **Status:** verified · **Commit:** `a3c92e8`

The prior QA pass (2026-07-31, ISSUE-006) fixed the list view
(`dynamic-table.tsx`) to resolve a foreign key to its label via
`ref_label_fields` + a shared `referenceLabel()` helper. The record
detail/edit view for the *same field* (`dynamic-form.tsx`) never got the
matching fix:

- `TableReferenceViewValue` (read-only detail display) only queried
  `field.ref_endpoint`. Any FK to a plain business table — the common case,
  configured via `ref_table_name` with no custom endpoint — never fired the
  query, so the raw id rendered as the label.
- `TableReferenceField` (edit-mode `<select>`) used the singular
  `ref_label_field` with a hardcoded `first_name`/`last_name` fallback
  instead of `ref_label_fields` + `referenceLabel`, so any label field
  outside that fallback also showed the raw id.

**Before:** Compound detail page, "Registered By Id": `aab9e316-8c6c-41da-8a4d-30aba0fafce0`
**After:** `James Smith` — on both the read-only detail view and the edit dropdown.

Both functions in `dynamic-form.tsx` now resolve the endpoint from
`ref_table_name` (falling back to `/bus/<table>`) the same way
`dynamic-table.tsx` does, and render through the shared `referenceLabel()`.

### ISSUE-003 — `seedValue` seeded non-person entities with a fake human name
**Severity:** High · **Category:** Content · **Status:** verified · **Commit:** `739a9df`

Any field literally named `name` (or ending in `_name`) got a random
`FIRST_NAMES + LAST_NAMES` value on the assumption that a "name" field
belongs to a person. That assumption is wrong far more often than right:
`Instrument.name`, `Team.name` and `Vendor.name` are all plain entity
names, so the instrument-bookings list showed lab instruments literally
named "James Smith" and "Mary Johnson" — indistinguishable from the actual
people in the "Booked By" column next to them. No example model in the repo
uses a `*_name` field for an actual person (real person fields are
`first_name`/`last_name`, handled separately, or specific enough to say so:
`contact_name`, `manager_name`).

**Before:** Instrument Bookings list — `Instrument Id: James Smith | Booked By Id: James Smith`
**After:** `Instrument Id: Name 1 | Booked By Id: James Smith`

Narrowed the person-name branch to field names that are unambiguous about
holding a person's name; a bare `name`/`*_name` now falls through to the
(already field-name-aware, from ISSUE-001) generic fallback.

### ISSUE-004 — generated `biome.json` had an invalid key, so lint silently never ran
**Severity:** High · **Category:** Tooling · **Status:** verified · **Commit:** `bbb8344`

`javascript.formatter.organizeImports` is not a valid key under Biome
1.9.4's schema — `organizeImports` is a top-level config section, not a
`javascript.formatter` option. Every generated app's `biome.json` shipped
with this, so `biome check`/`biome lint` failed immediately with a
"Biome exited because the configuration resulted in errors" deserialize
error — on every single generated project, not just this one.

The generator's own "mandatory linting checks" step swallowed that fatal
error and reported it as a generic "linting found issues," so this went
unnoticed: lint had never actually executed against any generated app's
source.

Fixed by moving `organizeImports` to the correct top-level location in
both `backend/biome.json.hbs` and `frontend/biome.json.hbs`.

### ISSUE-005 — biome's `useImportType` auto-fix broke NestJS dependency injection
**Severity:** Critical · **Category:** Functional · **Status:** verified · **Commit:** `36a9b83`

Fixing ISSUE-004 let `bun run lint` (`biome lint --write`, which the
generator runs automatically right after generation) actually execute for
the first time — and it immediately broke the app it had just generated.
`lint/style/useImportType` is a "safe, fixable" rule that rewrites a value
import to `import type` whenever the import is only referenced in type
position syntactically — which is exactly what a constructor parameter's
type annotation looks like. NestJS resolves constructor-injected
dependencies from `design:paramtypes` reflection metadata, which needs the
real (value) import present at runtime; `import type` erases it at compile
time, so Nest sees an empty token and refuses to boot:

```
Nest can't resolve dependencies of the ImmudbService (?). Please make sure
that the argument Function at index [0] is available in the AuditModule context.
```

Because ISSUE-004 meant `--write` had never actually run against any
generated backend before, this was latent rather than something a normal
QA pass on existing output would catch — it only surfaces once biome
itself is capable of running at all, which fixing ISSUE-004 in this same
session did. Caught by re-verifying ISSUE-004's fix with a full clean
regeneration and reboot, rather than trusting the "lint ran with warnings"
message.

Turned `style.useImportType` off in the backend's `biome.json.hbs` so the
generator's mandatory auto-fix pass can't silently strip a DI-relied-on
import out from under NestJS. Left enabled for the frontend, which has no
reflection-based DI and no observed breakage.

---

## Feature verification

Everything re-checked in the browser on the final clean regeneration:

- **Auth.** Login as `admin@admin.com` / `admin` works; dashboard renders with
  0 console errors post-login (401s pre-login are expected — the dashboard's
  fetches fire before the redirect settles, noted as a non-issue in the prior
  report and still true here).
- **Entity categories.** All 7 `%%category` groups render on the dashboard in
  the expected order, matching the prior report.
- **List / detail / edit views.** Compound and Instrument Booking both
  checked: list, detail (read-only), and edit-mode dropdown all show
  consistent, correctly-resolved data after the fixes above.
- **Mobile.** Dashboard and Compound list at 375×812 — single-column cards,
  table hides overflow columns responsively, `scrollWidth === clientWidth`.
- **Audit log.** Renders its empty state correctly (0 actions performed this
  session, so 0 records — expected, not a bug).
- **Migrations + seeds.** A full drop-database → regenerate → migrate → seed
  cycle completes cleanly: 10 migrations, 6 seed files, 7 categories, 17/17
  entities assigned.

## Console health

Zero console errors across dashboard, compound list/detail/edit, and
instrument-booking list, on the final clean regeneration.

## Environment note

Postgres 16 wasn't running by default in this sandbox and had no role for the
generated app's `DATABASE_URL=postgresql://root@localhost/...` (no-password,
TCP) — started the cluster and switched `127.0.0.1`/`::1` to `trust` auth in
`pg_hba.conf` for local dev. gstack's browse binary and Chromium build were
already the right version this session (no bridging needed, unlike the prior
report).
