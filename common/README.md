# app-and-report-with-ai-tanstack

Two products and one modelling language. This repository is the **orchestrator**:
it holds the language, and the pieces that compose the two products into one
running system. It does not hold either product — both are separate
repositories, checked out on demand at the commits `../deps.json` pins.

| | What it is | Repository |
|---|---|---|
| **APPWITHAI** | An AI-assisted ERD designer and full-stack code generator. One Mermaid document describes the data, the decisions and the processes; the generator compiles all three into a running NestJS + TanStack Start application | `businessappwithai/app-with-ai-tanstack` |
| **Enterprise Reporting** | A multi-datasource analytics platform: connect external databases, ask questions in natural language, and publish the answers as reports, charts, dashboards and scheduled deliveries | `businessappwithai/enterprise_reporting_tanstack` |

```bash
../deps.sh --install     # place both beside common/, at their pinned commits
../deps.sh --status      # what is checked out, and whether it matches
```

Both read the same language, and everything that is neither product lives in
`common/`, one level up from this file:

```
../
├── deps.json                the two product repositories, and the commit of each
├── deps.sh                  place them locally
├── start.sh                 generate an application and bring both up
├── stop.sh
├── docker-compose.yml
├── app-with-ai-tanstack/            ← placed by ./deps.sh, gitignored
├── enterprise_reporting_tanstack/   ← placed by ./deps.sh, gitignored
└── common/
    ├── language/    ⭐ EML — definition, spec, grammar, checker, fixer, composer, the `eml` CLI
    ├── build/          model → reporting pack · the /app and /report subpath overlay
    ├── seed/           loads the generated application into the reporting platform
    ├── docker/         the two Dockerfiles, nginx, and the demo database init
    ├── scripts/        the checks behind `bun run check`
    ├── html/           the published guide, checker.js / fixer.js, run-in-a-browser
    ├── website/
    │   ├── llmtext/    llms-full.txt · llmdetailed.txt · llms-reporting.txt
    │   └── viewers/    the model viewers
    └── examples/       sample models
```

`language/appwithai-language.json` is the canonical definition. Each product
repository keeps its own copy for its own CI — `app-with-ai-tanstack/language/`
under the same name, and `enterprise_reporting_tanstack/language/` as an older
fork called `erdwithai-language.json`. **All three have drifted from each other,
and when any of them disagrees with this copy, this copy is the language.**

They were once meant to be byte-identical, and this file said so. They are not:
at the pinned commits the two `appwithai-language.json` files differ from line 11
on, and nothing checks them against each other. Only the two copies of the shared
*example models* are held byte-identical, by `check:models` — see **Checks**
below.

## Running both, from one model

```bash
./deps.sh --install                           # once — both products, at their pins
./start.sh                                    # the reference CRM model
./start.sh common/examples/my-app.eml.mmd     # any other model
./start.sh my-app.eml.mmd --profile prod      # two database servers
```

`start.sh` refuses to run without the checkouts, and says which one is missing:
without them the generate fails on a module it cannot resolve and compose fails
on a build context that does not exist, both a long way in and neither error
naming what is actually absent.

Then:

| | |
|---|---|
| http://localhost/app | the application generated from the model |
| http://localhost/report | the reporting platform, already holding that application's schema as a data source and its reports, charts and dashboard |

`start.sh` checks the model, generates the application, puts both applications on
their URL prefix, derives the reporting pack from the model, and brings the stack
up. `stop.sh` takes it down; `stop.sh --volumes` discards the databases too.
Everything it writes goes under `common/.runtime/`, which is not checked in.

**The two profiles.** `demo` (the default) runs one Apache AGE PostgreSQL 16
holding three databases — the application's, `enterprise_config`, and
`ers_knowledge`. `prod` runs two servers, each the image its application actually
asks for: pgvector on PostgreSQL 18 for the generated application, Apache AGE on
16 for the reporting platform. Under both, the reporting platform's configuration
never shares a database with the application it reports on — regenerating the
application drops and recreates its tables, and the reports have to survive that.

**Where the reports come from.** `common/build/reporting-pack.ts` derives a
baseline from structure: a register per entity, a breakdown per `%%enum`-bound
column, a lifecycle per state machine in the diagram's own order, children per
`oneToMany`. That baseline describes the shape of the data and nothing about the
business running on it — so a model can also carry `%%report` directives, each a
question its users actually ask written as the SQL that answers it. Those are
listed first and take the top of the dashboard. See
`website/llmtext/llmdetailed.txt` §10.5.1.

## One model, three targets

```bash
bun language/checker.ts examples/analytics-reporting.eml.mmd

# A dependency-free prototype
bun language/cli/eml.ts generate -i <model> -o ./out --stack node-rest

# The whole application: NestJS + Fastify + Kysely, TanStack Start front end
bun language/cli/eml.ts generate -i <model> -o ./out --stack tanstack-nestjs

# Entities for the reporting platform: server functions, routes, a Kysely migration
bun language/cli/eml.ts generate -i <model> -o ./out --stack enterprise-reporting
```

The three differ in what they write, never in what they understand — all of them
read the same parsed model. They do not reach equally far into the language, and
the `enterprise-reporting` target reaches least on purpose: that repository
already holds auth, two layers of RBAC, an encrypted connection manager, an
NL→SQL pipeline, a job runner and a UI shell, so the target emits only what a new
entity needs. It does **not** compile workflows or `%%rbac` — see
`language/README.md` for the coverage table, and the `README.md` the target
writes beside its output for the integration steps.

## Reading further

| | |
|---|---|
| The language | [`language/README.md`](language/README.md), then `language/spec/` |
| APPWITHAI, in full | [`website/llmtext/llms-full.txt`](website/llmtext/llms-full.txt) |
| The interactive authoring walkthrough | [`website/llmtext/llmdetailed.txt`](website/llmtext/llmdetailed.txt) |
| The reporting platform, in full | [`website/llmtext/llms-reporting.txt`](website/llmtext/llms-reporting.txt) |
| The human guide | [`html/index.html`](html/index.html) — nine chapters building a CRM |

Each product repository keeps its own `CLAUDE.md`, and that is the authority on
that project's commands, conventions and CI — read it in the checkout `./deps.sh`
placed, not from memory. `../CLAUDE.md` is the authority on this repository and
on how the two are run together.

## Checks

This folder has its own manifest and its own checks, separate from either
product's:

```bash
bun install
bun run check            # models, types, lint, every stack, and the reporting SQL
```

| | |
|---|---|
| `check:models` | Every model in `language/examples/` and `examples/` checks clean, and `html/models/` is still byte-identical to its counterpart |
| `type-check` | `language/**`, `build/**` and `scripts/**` under the strict config (`tsconfig.language.json`) |
| `lint` | Biome over `language/` and `scripts/` |
| `check:stacks` | All three `--stack` targets actually generate |
| `check:pack` | Every query in every model's reporting pack runs against a **real** generated schema. Skips itself with a message when no PostgreSQL is reachable |

**Every one of these needs `../deps.sh` to have run.** Two modules under
`language/cli` import from `app-with-ai-tanstack` — the shipped JDM converter
and the flowchart parser — and `jdm.ts` does it unconditionally, on every
generation path. Without that checkout `type-check` reports TS2307 and *all
three* stack targets fail at module resolution, not just the heavy one.

`check:stacks` additionally needs that workspace's own dependencies installed
(`../deps.sh --install`): `tanstack-nestjs` drives the shipped orchestrator,
which resolves `zod` and the rest from there. Pass `--skip-heavy` to run only
the two self-contained targets:

```bash
bun scripts/check-stacks.ts --skip-heavy
```

## CI

`.github/workflows/` holds two workflows:

| | |
|---|---|
| `root-ci.yml` | `paths:`-filtered to `common/**`, `deps.json` and the scripts that run the two together. A `resolve` job reads `deps.json`, then three jobs check out `app-with-ai-tanstack` against it and run models/types/lint, every stack, and the reporting pack against a real PostgreSQL |
| `build-and-run.yml` | The orchestrator, on `workflow_dispatch` and nightly. Checks out both products at their pins, generates an application, injects configuration, brings the stack up, and proves `/app` and `/report` answer and the seeder exited 0 |

Both read the pins from `deps.json` and nowhere else — no workflow restates a
ref in a `with:` block, which is how pins drift. Each product's own CI now lives
in its own repository, where the code is.
