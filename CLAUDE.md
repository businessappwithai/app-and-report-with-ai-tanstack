# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

---

## What this repository is

An **orchestrator**. It holds the modelling language two products read, and the
pieces that compose those products into one running system. It does not hold
either product.

| | What it is | Where |
|---|---|---|
| **This repository** | EML — the language, checker, fixer, composer and `eml` CLI — plus the reporting-pack and subpath-overlay builds, the seeder, the Docker pieces, the published guide and the model viewers | [`common/`](common/) |
| **APPWITHAI** | An AI-assisted ERD designer and full-stack code generator. One Mermaid document describes the data, the decisions and the processes; the generator compiles all three into a running NestJS + TanStack Start application | `businessappwithai/app-with-ai-tanstack` |
| **Enterprise Reporting** | A multi-datasource analytics platform: connect external databases, ask questions in natural language, and publish the answers as reports, charts, dashboards and scheduled deliveries | `businessappwithai/enterprise_reporting_tanstack` |

The two products were subfolders here until recently. They are now separate
repositories with their own CI, their own release cadence and their own
lockfiles, checked out on demand:

```
check the model            common/language/checker.ts
      ↓
generate the application   --stack tanstack-nestjs, driving the orchestrator
      ↓                    inside app-with-ai-tanstack
put it on /app             common/build/subpath-overlay.ts
      ↓
derive the reporting pack  common/build/reporting-pack.ts
      ↓
inject configuration       common/.runtime/.env
      ↓
build and start            docker compose — postgres, the generated backend and
      ↓                    front end, the reporting platform, the seeder that
      ↓                    loads one into the other, nginx in front
smoke-test                 /app and /report answer, and the seeder finished
```

---

## `deps.json` — the pins, and the only place they live

`deps.json` names the commit of each product repository that this one is known
to work with. **Nothing else names a ref.** `./deps.sh` reads it to place the
checkouts locally; every workflow reads it in a `resolve` job and feeds the
result to `actions/checkout`. A local tree and a runner therefore check out
identically, and moving a pin is one edit.

```bash
./deps.sh                # clone or update both to their pinned refs
./deps.sh --install      # …and bun install --frozen-lockfile in each
./deps.sh --status       # what is checked out, and whether it matches
./deps.sh --update       # resolve each branch to its head and rewrite deps.json
```

The checkouts land at `app-with-ai-tanstack/` and
`enterprise_reporting_tanstack/` beside `common/`, and are **gitignored**. They
are not vendored code and not submodules — treat them as read-only working
copies of someone else's repository. `--update` refuses to move a checkout that
has uncommitted changes, because the likeliest reason for them is that someone
is debugging across the boundary.

**Moving a pin is a deliberate step, taken by running the checks:**

```bash
./deps.sh --update && ./deps.sh --install && cd common && bun run check
```

### Why the checkouts are needed, precisely

Two modules under `common/language/cli` reach into `app-with-ai-tanstack` on
purpose, so that the CLI and the modelling tool cannot disagree about what a
rule flow compiles to:

| Reaches for | From | Consequence when absent |
|---|---|---|
| `packages/web/src/lib/jdm-converter.ts`, `mermaid-flowchart-parser.ts` | `language/cli/src/generate/jdm.ts`, as a static import | **Every** `--stack` target fails at module resolution, and `tsc` reports TS2307. `jdm.ts` sits on every generation path — this is not just the heavy target |
| `packages/generator/src/pipeline/generate-application.ts` | `language/cli/src/generate/tanstack.ts`, resolved at runtime | `--stack tanstack-nestjs` cannot generate |

Nothing type-checks either path — one imports across a repository boundary, the
other resolves from a non-literal specifier — so moving either file breaks
generation and nothing else. Running the generator is the only way to notice,
which is what `check:stacks` is for.

`tanstack-nestjs` additionally needs `app-with-ai-tanstack`'s **own**
dependencies installed: with a `node_modules` under `common/` and none there,
resolution stops here and the generate fails on `Cannot find package 'zod'`.
That is why `./deps.sh --install` exists and why `start.sh` refuses to run
without it.

`enterprise_reporting_tanstack` is needed at a different moment — it is the
Docker build context for the `report` and `seeder` services, and
`common/seed/seed-reporting.ts` is copied into its tree at image build time and
imports through its `@/` alias, using that project's real `getDb`, `encrypt` and
`introspectAndCacheSchema` rather than a second implementation of any of them.

---

## Layout

```
.
├── deps.json             ⭐ the two product repositories, and the commit of each
├── deps.sh               place them locally  (wraps common/scripts/deps.ts)
├── start.sh              generate an application and bring both up
├── stop.sh               --volumes discards the databases too
├── docker-compose.yml    profiles: demo (one PostgreSQL) · prod (two)
├── .github/workflows/
│   ├── root-ci.yml       models · types · lint · stacks · reporting pack
│   └── build-and-run.yml the orchestrator: generate → configure → build → run → smoke-test
├── common/               everything that is not a product
│   ├── package.json          the only manifest; `bun run check` lives here
│   ├── tsconfig.language.json  strict; covers language/, build/, scripts/
│   ├── language/         EML — definition, spec, grammar, checker, fixer, composer, CLI
│   │   ├── appwithai-language.json   ⭐ the canonical machine-readable definition
│   │   ├── biome.json                the lint config (deliberately not at the root)
│   │   ├── checker.ts · fixer.ts · composer.ts · rag.ts · index.ts
│   │   ├── grammar/appwithai.ebnf
│   │   ├── spec/         00-overview · 01-erd · 02-business-rules · 03-workflows
│   │   │                 04-types-and-modifiers · 05-directives
│   │   ├── cli/          eml.ts, and src/generate/{app,tanstack,enterprise-reporting,jdm}.ts
│   │   └── examples/     crm · dance-studio · ecommerce · helpdesk · minimal
│   ├── build/            reporting-pack.ts · subpath-overlay.ts
│   ├── seed/             seed-reporting.ts — loads a generated app into the platform
│   ├── docker/           reporting.Dockerfile · seeder.Dockerfile · nginx · pg-init
│   ├── scripts/          deps.ts · check-models.ts · check-stacks.ts · check-reporting-pack.ts
│   ├── html/             the published nine-chapter guide, checker.js, fixer.js, wasm-app
│   ├── website/
│   │   ├── llmtext/      llms-full.txt · llmdetailed.txt · llms-reporting.txt
│   │   └── viewers/      the ERD, rules and workflow model viewers
│   └── examples/         analytics-reporting · drug-discovery · investment-planning · ERD sketches
│
├── app-with-ai-tanstack/            ← placed by ./deps.sh, gitignored
└── enterprise_reporting_tanstack/   ← placed by ./deps.sh, gitignored
```

**Everything runs from `common/`.** There is no manifest, lockfile or
`node_modules` at the repository root; `bun install` and every `bun run` belong
inside `common/`. The scripts resolve their own paths from `import.meta.dir`.

---

## Commands

```bash
./deps.sh --install      # first, always — the checks need the checkouts

cd common
bun install

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

bun scripts/check-stacks.ts --skip-heavy           # skips tanstack-nestjs only
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

With no dependency checkout, `tsc` reports **four** errors in
`language/cli/src/generate/jdm.ts` and every stack target fails. That is a
missing `./deps.sh`, not a broken repository.

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

Each product repository carries its own copy for its own CI —
`app-with-ai-tanstack/language/` and, under the older name
`erdwithai-language.json`, `enterprise_reporting_tanstack/language/`. All three
have drifted from each other — at the pinned commits, 90 normalized JSON lines
against app-with-ai-tanstack's and 200 against the reporting platform's.
**When any of them disagrees with the copy here, the copy here is the language.**

**All three declare `"version": "1.2.0"`.** The version cannot tell you which
copy you are holding, and nothing checks one against another, so drift is silent
in both directions: a change made here does not reach either product, and a
change made in one does not reach here. `check:models` compares
`language/examples/` against `html/models/` — a different pair, and the likeliest
reason to believe a cross-repository check exists when none does.

Every EML document is valid, renderable Mermaid. EML is a *semantic superset*:
it assigns generator meaning to `erDiagram`, `flowchart` and `stateDiagram-v2`,
and to renderer-safe `%%` directive comments.

**Directives may be indented.** `language/cli/src/parser.ts` trims each line
before testing `startsWith("%%")`, and the reference models indent their
directives four spaces to sit inside the diagram block they annotate. Grepping
for `^%%` therefore undercounts badly — `crm.eml.mmd` answers 0 to `^%%report`
and 33 to `%%report`. Search without the anchor.

### The three `--stack` targets

| `--stack` | Emits | Standalone |
|---|---|---|
| `node-rest` *(default)* | A dependency-free `node:http` app over a JSON-file datastore | Yes — `npm start`, no install |
| `tanstack-nestjs` | The full stack: NestJS + Fastify + Kysely backend, TanStack Start front end, migrations, seeds, dictionary, manual (~356 files). Drives the shipped orchestrator | Yes |
| `enterprise-reporting` | TanStack Start server functions (`.inputValidator()`), list/detail routes (shadcn/ui + TanStack Table), a Kysely PostgreSQL migration, a `Database`-interface snippet | **No** — code to drop into an `enterprise_reporting_tanstack` checkout |

They differ in what they write, never in what they understand: all three read
the same parsed model. `enterprise-reporting` reaches least on purpose — that
platform already has auth, two layers of RBAC, an encrypted connection manager,
an NL→SQL pipeline, a job runner and a UI shell, so the target emits only what a
new entity needs. It does **not** compile workflows or `%%rbac`. See
`language/README.md` for the coverage table.

---

## Conventions that bite

**Models are checked in twice.** `language/examples/*.eml.mmd` and
`html/models/*.eml.mmd` are the same files: one set is what the CLI reads, the
other is what the published guide serves. `check:models` asserts they are
byte-identical. **Edit both.** `common/examples/` carries no such constraint.

**The checker writes a `.error` file beside every model it reads.** That is its
interface, not an accident. `check-models.ts` removes any it created that git
does not already track, so a passing run leaves the tree clean;
`examples/hospital-management-system.mmd.error` is committed on purpose and
escapes `.gitignore`'s `*.eml.mmd.error` rule by not matching it.

**Biome's config is `language/biome.json`, not a root config.** A config at the
repository root makes each product's own config a "nested root" and Biome then
refuses to run at all. That is also why `bun run lint` is two commands: pointing
Biome at `language` and `scripts` in one invocation makes it find the same file
twice and fail the same way. Linting `language/` means `cd`-ing into it; linting
`scripts` and `build` means `--config-path language` from outside.

**CI fails on a dirty tree.** The `language` job runs `git status --porcelain`
after the checks and fails on any tracked modification. A check that rewrites a
file it read is a bug in the check. The dependency checkouts are gitignored, so
they cannot trip it.

**`check:pack` skips itself when no PostgreSQL is reachable** and says so. CI
passes `--require-server` so a database that never came up fails instead: a
check that quietly passes without running is indistinguishable from one that
ran, and the whole point of that file is to not be that.

---

## Running the two applications together

```bash
./deps.sh --install
./start.sh                                     # the reference CRM model
./start.sh common/examples/my-app.eml.mmd      # any other model
./start.sh my-app.eml.mmd --profile prod       # two database servers
./start.sh --port 8080                         # somewhere other than :80
```

| | |
|---|---|
| http://localhost/app | the application generated from the model |
| http://localhost/report | the reporting platform, already holding that application's schema as a data source and its reports, charts and dashboard |

The platform signs in as `admin@admin.com` / `admin`. The first start migrates
and seeds the application, then loads its schema and reporting pack into the
platform; until the seeder exits, `/report` is up but **empty**. `./stop.sh`
takes it down, `--volumes` discards the databases too.

`start.sh`'s six steps: check the model → generate into `common/.runtime/app` →
overlay onto `/app` → derive the pack into `common/.runtime/pack` → write
`common/.runtime/.env` → `docker compose up`. Everything it writes stays under
`common/.runtime/`, which is gitignored. **Neither product checkout is
modified.**

**Secrets are generated once and then left alone.** Regenerating
`ENCRYPTION_KEY` leaves every stored data-source password undecryptable, and the
failure looks like a broken data source rather than a rotated key. Writing
`common/.runtime/.env` *before* running `start.sh` is therefore the supported
way to inject configuration — it keeps what it finds and rewrites only the block
it derives from the run. `build-and-run.yml` uses exactly that.

### The two profiles

- **`demo`** (default) — one `apache/age:PG16` holding three databases: the
  application's, `enterprise_config`, and `ers_knowledge`.
- **`prod`** — two servers, each the image its application asks for:
  `pgvector/pgvector:pg18` for the generated application, `apache/age:PG16` for
  the platform.

Under both, the platform's configuration never shares a database with the
application it reports on: regenerating the application drops and recreates its
tables, and the reports have to survive that.

**No service declares `depends_on` for a database.** A `depends_on` naming a
service outside the active profile makes compose refuse to start at all, so
anything that must run under both profiles cannot name either database. Each
waits for its own: the generated backend migrates on start and is restarted
until that succeeds, the platform bootstraps its schema on first request, and
the seeder waits for both — including for the application's `bus_` tables to
exist, since an empty database means "not migrated yet" rather than "nothing to
report on".

**Neither prefix is stripped by nginx.** Both applications are *built* to live
under their prefix — bundler `base`, router `basepath`, static lookup — so an
incoming `/report/dashboard` is the path the router expects to match. Stripping
would give the server `/dashboard` while every link it writes says
`/report/dashboard`, and navigation would break on the first click. nginx
addresses every upstream through a variable with `resolver 127.0.0.11`, so an
application that is not up yet answers 502 instead of refusing to start the
whole origin.

### Where the reports come from

`build/reporting-pack.ts` invents nothing. Every query is derived from something
the model declares:

| Model declares | Pack gets |
|---|---|
| an entity | a register — what rows exist, newest first |
| an `%%enum`-bound column | a breakdown, as a chart |
| `created_at` | volume by month, as a line |
| a `kind: state` workflow | a lifecycle over the states the diagram declares, in its order, zeroes included |
| numeric columns | a measures report, grouped by the entity's primary enum column |
| `oneToMany` | children per parent, ranked |

Names and descriptions come from `%%entity help:` and `%%field help:` — the only
place a model says what an entity is *for* rather than what shape it is. That is
the difference between a report called "bus_account by status" and one called
"Accounts by status" that explains what an account is in this business. A model
with no help text still produces a working pack; it just produces one named
after tables.

A model can also carry `%%report` directives — a question its users actually
ask, written as the SQL that answers it. Those are listed first and take the top
of the dashboard. See `website/llmtext/llmdetailed.txt` §10.5.1.

---

## CI

| Workflow | Trigger | What it does |
|---|---|---|
| `root-ci.yml` | push to `main`, PRs touching `common/**`, `deps.json`, the scripts or compose file | `resolve` reads the pins, then three jobs: models/types/lint, every stack, and the reporting pack against a real `postgres:16` |
| `build-and-run.yml` | `workflow_dispatch`, nightly at 04:00 UTC | The whole thing: check out both products at their pins, generate an application from a model, inject configuration, `docker compose up`, wait for `/app` and `/report` to answer, assert the seeder exited 0, report what the platform was loaded with, upload logs and the generated source, tear down |

Both start with a `resolve` job that reads `deps.json` and emits the repository
and ref for each product as job outputs. **No workflow restates a ref in a
`with:` block** — that is how pins drift.

`build-and-run.yml` takes `model`, `profile`, `app_ref` and `report_ref` inputs;
the two refs override `deps.json` for a one-off run, so a branch of the
generator can be tried against the pinned platform without committing anything.
Every run prints the three commits it actually used in its summary.

`reporting-pack` is the only check that runs the derived SQL against the schema
the generator actually emits. The pack is built from a parsed model while the
tables come from a separate compiler in another repository, and nothing
type-checks one against the other — a column the generator renames leaves the
pack building cleanly and every report failing at run time. It caught exactly
that on its first run.

A path-filtered run that is skipped reports no status at all, so if any of these
are made required checks they need a skip-path fallback.

---

## Git workflow

1. Branch from `main`.
2. `./deps.sh --install`, then `cd common && bun install`. Neither check means
   anything without both.
3. Run `bun run check` before pushing — or at minimum `check:models`,
   `type-check` and `lint`.
4. If you touched a model under `language/examples/`, update its twin under
   `html/models/`.
5. If you moved a pin in `deps.json`, say in the commit message what moved and
   why, and confirm the checks passed against the new commit.
6. Target `main` for PRs.
