# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

---

## What this repository is now

It holds **EML** — a Mermaid-based modelling language — its checker, fixer,
composer and `eml` CLI, plus the build, seed and Docker pieces that used to run
two generated products together. All of that lives under [`common/`](common/).

**The two product folders were deleted on this branch.** `app-with-ai-tanstack/`
(the AI-assisted ERD designer and full-stack generator) and
`enterprise_reporting_tanstack/` (the multi-datasource analytics platform) are
gone from the working tree; their history is intact in `main` and recoverable
with `git show main:<path>`.

Read the section below before running anything: the deletion left this folder in
a state where its own checks and its own CLI do not pass.

---

## ⚠️ Known-broken after the deletion — read first

`common/language/cli/src/generate/jdm.ts` imports two modules across the folder
boundary that no longer exists:

```ts
import { convertToJdm } from "../../../../../app-with-ai-tanstack/packages/web/src/lib/jdm-converter.ts";
import type { FlowAST, … } from "../../../../../app-with-ai-tanstack/packages/web/src/lib/mermaid-flowchart-parser.ts";
```

That import is unconditional and `jdm.ts` is on every generation path, so
**every `--stack` target now fails at module resolution**, not just the heavy
one:

| Command | State |
|---|---|
| `bun run check:models` | ✅ passes — 8 models clean, both copies identical |
| `bun run lint` | ✅ passes — 29 files, no findings |
| `bun run type-check` | ❌ 4 errors in `jdm.ts` (2 × TS2307 for the missing modules, 2 × TS7006 falling out of them) |
| `bun run check:stacks` | ❌ all three targets fail: `Cannot find module '…/jdm-converter.ts'` |
| `bun run check:pack` | ❌ depends on generating, so it fails the same way |
| `./start.sh` | ❌ step 2 generates with `--stack tanstack-nestjs`; also needs `common/.runtime/app` and an installed `app-with-ai-tanstack` workspace |
| `docker compose up` | ❌ `app-backend` / `app-frontend` build from `./common/.runtime/app`, which `start.sh` can no longer produce; `report` and `seeder` build from `./enterprise_reporting_tanstack`, which is gone |

The comment at the top of `jdm.ts` explains why the import was a cross-folder
reference rather than a vendored copy: the CLI and the modelling tool must not
disagree about what a rule flow compiles to. That rationale no longer applies —
there is no second copy to disagree with — so the fix is a decision someone
still has to make. **Do not silently vendor, stub or delete it as a side effect
of unrelated work.** The three options, smallest first:

1. Vendor `jdm-converter.ts` (58 lines) and `mermaid-flowchart-parser.ts`
   (105 lines) into `common/language/cli/src/generate/`. Restores `node-rest`
   and `enterprise-reporting`.
2. Make JDM emission optional — lazy-import it, skip when absent. Restores the
   same two targets and keeps the door open for re-linking.
3. Also vendor `orchestrator.ts` (165 lines) plus the template tree it drives,
   to restore `tanstack-nestjs`. Much larger; that target generates ~356 files
   through machinery that lived entirely in the deleted folder.

Dangling references the deletion also left behind, none of them fixed:

- `.github/workflows/app-with-ai-tanstack-ci.yml` and
  `.github/workflows/enterprise_reporting_tanstack-ci.yml` — whole workflows for
  folders that no longer exist. Their `paths:` filters can never match, so they
  simply never run.
- `.github/workflows/root-ci.yml` — `paths:` names three files under
  `app-with-ai-tanstack/packages/`, and the `stacks` and `reporting-pack` jobs
  each run `bun install --frozen-lockfile` with
  `working-directory: app-with-ai-tanstack`.
- `docker-compose.yml` — four services build from the two deleted trees.
- `common/scripts/check-stacks.ts` — its header documents the cross-folder
  imports as the reason it exists.
- `common/language/appwithai-language.json` — `repositoryLayout` and every
  `packages/…` path in it describe the old two-product layout.
- `common/README.md` and `common/language/README.md` — both still describe two
  products and three copies of the language.

---

## Layout

```
.
├── start.sh              generate an application and bring both up  (broken — see above)
├── stop.sh               ./stop.sh --volumes discards the databases too
├── docker-compose.yml    profiles: demo (one PostgreSQL) · prod (two)
├── .github/workflows/    root-ci.yml is the only one that can still match
└── common/               ⭐ everything that is not a product
    ├── package.json          the only manifest left; `bun run check` lives here
    ├── tsconfig.language.json  strict; covers language/, build/, scripts/
    ├── language/         EML — definition, spec, grammar, checker, fixer, composer, `eml` CLI
    │   ├── appwithai-language.json   ⭐ the canonical machine-readable definition
    │   ├── biome.json                the lint config (deliberately not at the root)
    │   ├── checker.ts · fixer.ts · composer.ts · rag.ts · index.ts
    │   ├── grammar/appwithai.ebnf
    │   ├── spec/         00-overview · 01-erd · 02-business-rules · 03-workflows
    │   │                 04-types-and-modifiers · 05-directives
    │   ├── cli/          eml.ts, and src/generate/{app,tanstack,enterprise-reporting,jdm}.ts
    │   └── examples/     crm · dance-studio · ecommerce · helpdesk · minimal
    ├── build/            reporting-pack.ts · subpath-overlay.ts
    ├── seed/             seed-reporting.ts — loads a generated app into the platform
    ├── docker/           reporting.Dockerfile · seeder.Dockerfile · nginx · pg-init
    ├── scripts/          check-models.ts · check-stacks.ts · check-reporting-pack.ts
    ├── html/             the published nine-chapter guide, checker.js, fixer.js, wasm-app
    ├── website/
    │   ├── llmtext/      llms-full.txt · llmdetailed.txt · llms-reporting.txt
    │   └── viewers/      the ERD, rules and workflow model viewers
    └── examples/         analytics-reporting · drug-discovery · investment-planning · ERD sketches
```

**Everything runs from `common/`.** There is no manifest, lockfile or
`node_modules` at the repository root; `bun install` and every `bun run` belong
inside `common/`. The scripts resolve their own paths relative to
`import.meta.dir`, so `bun scripts/check-models.ts` works from there and nowhere
else.

---

## Commands

```bash
cd common
bun install              # required — see "Install first" below

bun run check            # models → types → lint → stacks → pack, in that order
bun run check:models     # every model checks clean, and the duplicated copies match
bun run type-check       # tsc --project tsconfig.language.json
bun run lint             # Biome over language/ and scripts/ + build/
bun run lint:fix
bun run check:stacks     # every --stack target actually generates
bun run check:pack       # every derived query runs against a real generated schema
bun run check:pack:ci    # same, but --require-server: a missing database fails
bun run pack             # bun build/reporting-pack.ts
```

Individual pieces:

```bash
bun language/checker.ts examples/analytics-reporting.eml.mmd
bun language/fixer.ts <model.eml.mmd>              # applies the auto-fixable codes in place

bun language/cli/eml.ts validate -i <model>
bun language/cli/eml.ts info -i <model>
bun language/cli/eml.ts generate -i <model> -o ./out --stack node-rest

bun scripts/check-stacks.ts --skip-heavy           # only the two self-contained targets
CHECK_STACKS_MODEL=language/examples/crm.eml.mmd bun scripts/check-stacks.ts
```

`eml` flags: `-i/--input`, `-o/--output`, `-n/--name`, `--stack`, `--docker`,
`--github <owner/repo>`, `--github-token`, `--private`/`--public`,
`--no-autofix`, `--force`, `--json`, `-h/--help`, `-v/--version`.

### Install first — the failure modes are silent

With no `node_modules` under `common/`, `tsc` reports thousands of phantom
errors: every `node:` builtin and every `process` is unresolvable. The manifest
carries `@types/node` and `@types/bun` mostly for this reason. Install before
you believe any type-check result.

### Use bun, never npm or pnpm

Bun is the runtime, the package manager and the test runner. CI pins
`BUN_VERSION: "1.3.11"`; the manifest requires `>=1.3.11`.

---

## The language

`common/language/appwithai-language.json` is the **single source of truth** —
type vocabulary, modifiers, cardinalities, hook types, rule-node shape
semantics, directives, grammar and the generator contract. Everything else in
`language/` documents or loads it. Load it through the typed accessor in
`language/index.ts` (`loadLanguageDefinition`, `normalizeType`,
`cardinalityKind`, `isHookType`), never by reading the JSON directly.

Two older forks of this file used to live in the product folders. Both are gone;
what remains is the language, without qualification. (For the record, they had
already drifted from it — the "byte-identical" claim in `common/README.md` was
stale before the deletion.)

Every EML document is valid, renderable Mermaid. EML is a *semantic superset*:
it assigns generator meaning to `erDiagram`, `flowchart` and `stateDiagram-v2`,
and to renderer-safe `%%` directive comments. Directive parsers anchor at `^%%`.

### The three `--stack` targets

| `--stack` | Emits | Standalone |
|---|---|---|
| `node-rest` *(default)* | A dependency-free `node:http` app over a JSON-file datastore | Yes — `npm start`, no install |
| `tanstack-nestjs` | The full stack: NestJS + Fastify + Kysely backend, TanStack Start front end, migrations, seeds, dictionary, manual (~356 files) | Drove the orchestrator in the deleted folder — **currently unbuildable** |
| `enterprise-reporting` | TanStack Start server functions (`.inputValidator()`), list/detail routes, a Kysely PostgreSQL migration, a `Database`-interface snippet | No — it was code to drop into an `enterprise_reporting_tanstack` checkout |

They differ in what they write, never in what they understand: all three read
the same parsed model. `enterprise-reporting` reaches least on purpose — the
platform it targeted already had auth, RBAC, the connection manager, NL→SQL,
a job runner and a UI shell, so the target emitted only what a new entity needs.
It never compiled workflows or `%%rbac`. See `language/README.md` for the
coverage table.

---

## Conventions that bite

**Models are checked in twice.** `language/examples/*.eml.mmd` and
`html/models/*.eml.mmd` are the same files: one set is what the CLI reads, the
other is what the published guide serves. `check:models` asserts they are
byte-identical. **Edit both.** `common/examples/` carries no such constraint.

**The checker writes a `.error` file beside every model it reads.** That is its
interface, not an accident. `check-models.ts` removes any it created that git
does not already track, so a passing run leaves the tree clean;
`examples/hospital-management-system.mmd.error` is committed on purpose and is
excluded from `.gitignore`'s `*.eml.mmd.error` rule by not matching it.

**Biome's config is `language/biome.json`, not a root config.** A config at the
repository root made the (then-present) product configs "nested roots" and Biome
refused to run at all. That is also why `bun run lint` is two commands: pointing
Biome at `language` and `scripts` in one invocation makes it find the same file
twice and fail the same way. Linting `language/` means `cd`-ing into it; linting
`scripts` and `build` means `--config-path language` from outside.

**CI fails on a dirty tree.** The `language` job runs `git status --porcelain`
after the checks and fails on any tracked modification. A check that rewrites a
file it read is a bug in the check.

**`check:pack` skips itself when no PostgreSQL is reachable** and says so. CI
passes `--require-server` so that a database that never came up fails instead:
a check that quietly passes without running is indistinguishable from one that
ran.

---

## Running the two applications together (historical)

`./start.sh` was the entry point, and its six steps still describe how the
pieces fit even though steps 2–6 cannot complete:

1. check the model (`language/checker.ts`)
2. generate the application into `common/.runtime/app` (`--stack tanstack-nestjs`)
3. put it on `/app` (`build/subpath-overlay.ts`)
4. derive the reporting pack into `common/.runtime/pack` (`build/reporting-pack.ts`)
5. write `common/.runtime/.env` — secrets generated **once**; regenerating
   `ENCRYPTION_KEY` leaves every stored data-source password undecryptable, and
   the failure looks like a broken data source rather than a rotated key
6. `docker compose --env-file … --profile <demo|prod> up -d --build`

Everything it writes lands under `common/.runtime/`, which is gitignored.
`http://localhost/app` served the generated application, `http://localhost/report`
the platform holding that application's schema, reports, charts and dashboard.

- **`demo`** (default) — one `apache/age:PG16` holding three databases: the
  application's, `enterprise_config`, and `ers_knowledge`.
- **`prod`** — two servers, each the image its application asked for:
  `pgvector/pgvector:pg18` for the application, `apache/age:PG16` for the
  platform.

Under both, the platform's configuration never shared a database with the
application it reported on: regenerating the application drops and recreates its
tables, and the reports had to survive that.

**No service declares `depends_on` for a database.** A `depends_on` naming a
service outside the active profile makes compose refuse to start at all, so
anything that must run under both profiles cannot name either database. Each
waits for its own instead.

**Neither prefix is stripped by nginx.** Both applications are *built* to live
under their prefix — bundler `base`, router `basepath`, static lookup — so an
incoming `/report/dashboard` is the path the router expects. Stripping would
give the server `/dashboard` while every link it writes says `/report/dashboard`.
nginx addresses every upstream through a variable with `resolver 127.0.0.11`, so
an application that is not up yet answers 502 instead of refusing to start the
whole origin.

**The reporting pack invents nothing.** `build/reporting-pack.ts` derives every
query from something the model declares: a register per entity, a breakdown per
`%%enum`-bound column, volume by month from `created_at`, a lifecycle per state
machine in the diagram's own order, a measures report from numeric columns,
children-per-parent from `oneToMany`. Names and descriptions come from
`%%entity help:` and `%%field help:`. A model may also carry `%%report`
directives — a question its users actually ask, written as the SQL that answers
it; those are listed first and take the top of the dashboard.

`seed/seed-reporting.ts` was copied into the platform's tree at image build time,
which is why it imports through `@/` — it used that project's real `getDb`,
`encrypt` and `introspectAndCacheSchema` rather than a second implementation of
any of them. It is idempotent by name, because it ran on every `up`.

---

## CI

`.github/workflows/root-ci.yml` is the only workflow that can still match a
path. Three jobs, `defaults.run.working-directory: common`:

| Job | Runs |
|---|---|
| `language` — Models, types and lint | `check:models`, `type-check`, `lint`, then a dirty-tree check |
| `stacks` — Generate with every stack | `check:stacks` (currently red) |
| `reporting-pack` — against a real schema | `check:pack:ci` against a `postgres:16` service (currently red) |

`reporting-pack` is the only check that runs the derived SQL against the schema
the generator actually emits. The pack is built from a parsed model while the
tables came from a separate compiler, and nothing type-checked one against the
other — a column the generator renamed left the pack building cleanly and every
report failing at run time. It caught exactly that on its first run.

A path-filtered run that is skipped reports no status at all, so if any of these
are made required checks they need a skip-path fallback.

The two product workflows are dead weight now — their `paths:` can never match.
Deleting them is reasonable; do it deliberately, not as a drive-by.

---

## Git workflow

1. Branch from `main`.
2. `cd common && bun install` before you trust any check.
3. Run at least `bun run check:models`, `bun run type-check` and `bun run lint`
   before pushing. `check:stacks` and `check:pack` are red for a known reason —
   do not read them as a green light, and do not "fix" them by weakening the
   check.
4. If you touched a model under `language/examples/`, update its twin under
   `html/models/`.
5. Target `main` for PRs.
