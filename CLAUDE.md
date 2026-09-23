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
derive the reporting pack  common/build/reporting-pack.ts — a CLI over the
      ↓                    generator's buildReportingPack: the queries, and one
      ↓                    reporting role per %%rbac role
write the front door       common/build/landing.ts — both applications, both
      ↓                    sets of accounts, served by nginx at /
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
./deps.sh --install      # …and bun install --frozen-lockfile where deps.json asks
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

**`--install` installs one checkout, not both.** `deps.json` carries an `install`
flag per dependency and only `app-with-ai-tanstack` sets it: nothing local reads
`enterprise_reporting_tanstack`'s `node_modules`, because that checkout is a Docker
build context and the image build runs its own install inside the image. A run that
prints `no install needed (see deps.json)` for it is behaving correctly.

A third module joins them, and it is the one that carries the most weight:

| Reaches for | From | Consequence when absent |
|---|---|---|
| `packages/generator/src/reporting/pack.ts` | `build/reporting-pack.ts`, as a static import | No pack can be derived at all — `bun run pack`, `check:pack` and `start.sh`'s fourth step all fail at module resolution |

**The pack derivation moved to the generator.** It was about eight hundred lines
in `build/reporting-pack.ts`; that file is now a 165-line CLI over
`buildReportingPack`. The move happened because the pack acquired two more
readers: a generated application's browser build serves the same reports behind
its own sign-in, and its deployable archive ships the pack in a `reporting/`
directory for the platform its compose file starts. Three derivations would have
been three answers to "what reports does this model have", and the first time
any of them changed the products would have disagreed about a model in front of
a reader. The direction is the point — the generator writes the applications, so
it owns what a model means.

What stayed here is what belongs to this repository: the CLI, the diagnostics
gate (on *this* repository's `parseEml`, the checker `check:models` runs), and
compose's idea of where a pack goes. `tsconfig.language.json` gained a `paths`
entry for `@appwithai/core/*` so the checkout's own aliases resolve; without it
`tsc` reports TS2307 on the generator's type imports and a cascade of implicit
`any` behind them.

`enterprise_reporting_tanstack` is needed at a different moment — it is the
Docker build context for the `report` and `seeder` services. **The seeder is now
that project's own script**, `scripts/seed-reporting-pack.ts`, rather than
`common/seed/seed-reporting.ts` copied into its tree at image build time: it
needs that project's real `getDb`, `encrypt` and `introspectAndCacheSchema`, it
writes eleven of that schema's tables, and a generated application's compose
file runs the same script. `common/seed/` is gone and `seeder.Dockerfile` no
longer takes the `common` build context.

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
│   ├── root-ci.yml       models · types · lint · stacks · both CLIs · reporting pack
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
│   ├── build/            reporting-pack.ts (a CLI over the generator's
│   │                     buildReportingPack) · subpath-overlay.ts · landing.ts
│   ├── docker/           reporting.Dockerfile · seeder.Dockerfile · nginx · pg-init
│   ├── scripts/          deps.ts · check-models.ts · check-stacks.ts · check-reporting-pack.ts
│   ├── html/             the published nine-chapter guide, checker.js, fixer.js, wasm-app
│   │                     — the two validators are BUILT here, not vendored (below)
│   ├── website/
│   │   ├── llmtext/      llms-full.txt · llmdetailed.txt · llms-reporting.txt
│   │   │                 · llmtextenhancement.txt · llmdetailedenhancement.txt
│   │   │                 — the last two are DERIVED from the first two (below)
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

bun run check            # models → types → lint → validators → stacks → CLIs → pack
bun run check:models     # every model checks clean, and the duplicated copies match
bun run type-check       # tsc --project tsconfig.language.json
bun run lint             # Biome over language/ and scripts/ + build/
bun run lint:fix
bun run build:language-tools        # bundle html/checker.js and html/fixer.js
bun run check:language-tools        # …and fail if the committed copies are stale
bun run check:stacks     # every --stack target actually generates
bun run check:clis       # both published CLIs generate — see below
bun run check:cli        # just `appwithai`
bun run check:cli:wasm   # just `appwithai-wasm`
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

## The four protocol documents, and the two that are derived

`common/website/llmtext/` carries the documents a language model is pointed at.
Two of them describe how to **write** a model from a brief; two describe how to
**change one that already exists**:

| | Start from a brief | Start from an existing `.mmd` |
|---|---|---|
| **One pass** | `llms-full.txt` | `llmtextenhancement.txt` |
| **Phased, with approval gates** | `llmdetailed.txt` §10 | `llmdetailedenhancement.txt` §10 |

**The enhancement pair is derived from the pair above it** — each is its base
with the protocol section swapped and the entire language reference copied
across byte for byte, so the four cannot come to disagree about the language
itself. The deriver and its sources live in `businessappwithai.github.io`
(`scripts/build-llmtext-enhancement.mjs`, `scripts/llmtext/`), which is where the
published copies are served from. Regenerate this repository's copies from its
own bases:

```bash
node <site>/scripts/build-llmtext-enhancement.mjs \
  --base common/website/llmtext/llms-full.txt   --protocol batch \
  --out  common/website/llmtext/llmtextenhancement.txt
node <site>/scripts/build-llmtext-enhancement.mjs \
  --base common/website/llmtext/llmdetailed.txt --protocol interactive \
  --out  common/website/llmtext/llmdetailedenhancement.txt
```

**Edit a base here and regenerate its companion in the same commit.** Nothing in
*this* repository checks it — the assertion lives upstream in
`app-with-ai-tanstack`'s `bun run test:llmtext` and on the site in
`scripts/check-spec.mjs`, both against their own copies. These three sets of
bases have already drifted from each other (see the language section below), and
the enhancement editions inherit whichever drift their base carries — which is
correct, and is why each repository derives from its own base rather than copying
the site's output.

### The published host is written in full

Every mention of the host in the five `llmtext/*.txt` documents is
`https://www.appwithai.org` — scheme and `www.` included. **`www` is canonical
and the apex serves the same files**; both carry a certificate. For part of this
project's life `www` was a DNS record onto the apex, so GitHub Pages served it a
certificate naming only the apex and every client refused it with
ERR_CERT_COMMON_NAME_INVALID — which is why these documents named the apex for a
while. It is a CNAME onto `businessappwithai.github.io` now. These copies used the
apex for most of their URLs and named the host without a scheme in prose, and a
model following them reported a failed validator fetch as a Markdown link around
a bare host, which is what its own tooling then tried to resolve. Nothing in this
repository checks it; the assertions are upstream in `bun run test:llmtext` and
on the site in `scripts/check-spec.mjs`, each against its own copies.

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

**Two CLIs, two runtimes, and they are not interchangeable.** `appwithai` runs on
bun **1.4** — what `app-with-ai-tanstack` pins, and what the Dockerfiles it
generates run on — while `appwithai-wasm` runs on bun **1.3**. `check:clis` runs
both under whichever bun is on `PATH`, which is right for a local sanity run;
`root-ci.yml` splits them into two jobs (`stacks` and `wasm-cli`) so each gets its
own runtime. A green `check:clis` locally therefore proves less than CI does — it
proves both CLIs work on *one* runtime, not that each works on the one it ships on.

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

**The published validators are built here, and that is a change.** `html/checker.js`
and `html/fixer.js` used to be copied from `app-with-ai-tanstack`'s `html/`. They are
bundled now, by `bun run build:language-tools`, from `language/browser/*.entry.ts` —
and each one **inlines `language/appwithai-language.json`**, the copy this repository
calls canonical.

That is the whole reason for the change. A vendored checker embeds the *product's*
language definition, so this repository was publishing a validator that disagreed with
the language it ships beside — by exactly the deltas kept on purpose. The difference is
visible: the vendored bundle contains no `repositoryLayout` and no `enterprise-reporting`,
the built one contains both.

Two things make it easy to get wrong:

- **`Bun.build` output depends on the bun version *and* the platform.** `root-ci.yml`
  pins `BUN_VERSION: 1.4.0` and runs on `linux-x64`; a bundle built on anything else is
  byte-wrong for CI while looking right locally. `scripts/lib/build-env.ts` reads that
  pin out of the workflow and says which case a mismatch is, rather than "out of date"
  — which is true of a stale build and misleading about a foreign one. The branch this
  arrived on had been built on bun 1.3.11: it passed `--check` on its author's machine
  and failed on CI's runtime.
- **`check:language-tools` is a CI step of its own.** The `language` job does not run
  `bun run check` — it runs `check:models`, `type-check` and `lint` separately — so
  adding a check to that script alone would never run in CI.

`website/viewers/eml-model.js` is **not** built here and stays vendored: its entry lives
in the `app-with-ai-tanstack` checkout and imports *that* repository's language copy.

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
| http://localhost/ | the front door: both applications and the accounts for each |
| http://localhost/app | the application generated from the model |
| http://localhost/report | the reporting platform, already holding that application's schema as a data source and its reports, charts and dashboard |

The first start migrates and seeds the application, then loads its schema and
reporting pack into the platform; until the seeder exits, `/report` is up but
**empty**. `./stop.sh` takes it down, `--volumes` discards the databases too.

### Two applications, two logins, and why they are not merged

This is the thing most likely to be got wrong, so the root serves a page about
it rather than redirecting. `/` used to `return 302 /app/` under a comment
saying "guessing which one somebody meant is worse than saying so" — and then
guessing. A reader who did not scroll back through the terminal never learned
`/report` existed, so the platform that had just been built and attached to
their application was invisible.

|  | `/app` | `/report` |
|---|---|---|
| Database | `appdb` | `enterprise_config` |
| Users | its own table, its own session | its own table, its own session |
| A role decides | what you may **do** to a record | which tables your queries may **read** |
| `sales_manager` | `sales.manager@<app>.example.com` | `sales.manager@<app>.reports.example.com` |

`reporting-pack.ts` derives the second column from the *same* `%%rbac` the
application compiles, so the two role sets line up by name — one reporting role
per declared role, permitted to read exactly the `bus_` tables that role's
`read` rules admit. **It is a mirror, not a shared system**: nothing is
federated, neither password works on the other side, and merging them would
force one product's meaning of "role" onto the other.

Two details worth knowing:

- **The addresses differ on purpose.** Identical ones would invite a reader to
  try a single password on both. The administrator is the exception and keeps
  `admin@admin.com` on each side — the same address, two different accounts, in
  two different databases — because that is what the platform bootstraps for
  itself. Every seeded account uses the password `admin`.
- **Only `read` rules narrow a reporting role.** `%%rbac` also restricts create,
  update and delete, and none of that means anything to somebody who cannot
  write through the reporting platform at all.

Both sides of that mirror are now *served* as well as seeded: the generated
application's browser build carries the same reports and the same roles behind a
sign-in of its own, and its deployable archive brings the real platform up
beside it. One derivation feeds all three.

**What each surface runs, and what it may claim.** The orchestrator and the
deployable archive both build `enterprise_reporting_tanstack` from its own
source and change nothing a reader sees — here `subpath-overlay.ts` rewrites
only URLs so it can live under `/report`, in the build container's copy; the
archive clones it at `REPORT_REF` and builds it as is. The browser build cannot
run a server, so its reporting app is a **preview drawn in the platform's own
layout and tokens**, labelled as one on every screen, with a working
Administration (users, roles, per-role table grants, the data source, an
activity log) and a page naming where the real one is for every screen that
needs the platform's servers. It lives in `app-with-ai-tanstack`, under
`packages/generator/templates/wasm/ui/views/{er-kit,report-app,report-admin}.js`.

The table counts on the front door are asserted against `deriveAccess`'s own
`entityCounts` before the pack is written — two readings of one fact is how the
products come to disagree about what a role may see, so the second is checked
against the first rather than merely resembling it.

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

`buildReportingPack` invents nothing — it lives in the generator
(`packages/generator/src/reporting/pack.ts`) and `build/reporting-pack.ts` is
the CLI over it. Every query is derived from something the model declares:

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
| `root-ci.yml` | push to `main`, PRs touching `common/**`, `deps.json`, the scripts or compose file | `resolve` reads the pins, then four jobs: models/types/lint, every stack plus the `appwithai` CLI, the `appwithai-wasm` CLI on its own runtime, and the reporting pack against a real `postgres:16` |
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
