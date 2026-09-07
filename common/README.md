# app-and-report-with-ai-tanstack

Two products and one modelling language.

| | What it is | Where |
|---|---|---|
| **APPWITHAI** | An AI-assisted ERD designer and full-stack code generator. One Mermaid document describes the data, the decisions and the processes; the generator compiles all three into a running NestJS + TanStack Start application | [`app-with-ai-tanstack/`](../app-with-ai-tanstack/) |
| **Enterprise Reporting** | A multi-datasource analytics platform: connect external databases, ask questions in natural language, and publish the answers as reports, charts, dashboards and scheduled deliveries | [`enterprise_reporting_tanstack/`](../enterprise_reporting_tanstack/) |

Both read the same language, and everything that is neither product lives in
`common/`, one level up from this file:

```
../
├── start.sh                 generate an application and bring both up
├── stop.sh
├── docker-compose.yml
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

`language/appwithai-language.json` is the canonical definition. Each subfolder
keeps its own copy for its own CI — `app-with-ai-tanstack/language/` is
byte-identical to this one, and `enterprise_reporting_tanstack/language/` is an
older fork under the name `erdwithai-language.json`. **When any of them disagrees
with the root copy, the root copy is the language.**

## Running both, from one model

```bash
./start.sh                                    # the reference CRM model
./start.sh common/examples/my-app.eml.mmd     # any other model
./start.sh my-app.eml.mmd --profile prod      # two database servers
```

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

Each subfolder keeps its own `CLAUDE.md`, and those are the authority on that
project's commands, conventions and CI.

## Checks

The root-level folders have their own manifest and their own checks, separate
from either subfolder's:

```bash
bun install
bun run check            # models, types, lint, every stack, and the reporting SQL
```

| | |
|---|---|
| `check:models` | Every model in `language/examples/` and `examples/` checks clean, and `html/models/` is still byte-identical to its counterpart |
| `type-check:language` | `language/**` under the strict config |
| `lint` | Biome over `language/` and `scripts/` |
| `check:stacks` | All three `--stack` targets actually generate |
| `check:pack` | Every query in every model's reporting pack runs against a **real** generated schema. Skips itself with a message when no PostgreSQL is reachable |

`check:stacks` is the one that needs `cd app-with-ai-tanstack && bun install`
first: `tanstack-nestjs` drives the shipped orchestrator, which needs that
workspace's dependencies. Pass `--skip-heavy` to run only the two
self-contained targets:

```bash
bun scripts/check-stacks.ts --skip-heavy
```

## CI

`.github/workflows/` holds three workflows, each `paths:`-filtered so a change
to one area does not run the others' jobs: one per subfolder, and
`root-language-ci.yml` for everything above them — which is what runs
`bun run check`. GitHub only executes workflows found in the repository root,
which is why the subfolders' own `.github/workflows/` files no longer run.
