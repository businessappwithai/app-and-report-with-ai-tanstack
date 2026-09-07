# app-and-report-with-ai-tanstack

Two products and one modelling language.

| | What it is | Where |
|---|---|---|
| **APPWITHAI** | An AI-assisted ERD designer and full-stack code generator. One Mermaid document describes the data, the decisions and the processes; the generator compiles all three into a running NestJS + TanStack Start application | [`app-with-ai-tanstack/`](app-with-ai-tanstack/) |
| **Enterprise Reporting** | A multi-datasource analytics platform: connect external databases, ask questions in natural language, and publish the answers as reports, charts, dashboards and scheduled deliveries | [`enterprise_reporting_tanstack/`](enterprise_reporting_tanstack/) |

Both read the same language, so it lives above both:

```
├── language/    ⭐ EML — definition, spec, grammar, checker, fixer, composer, the `eml` CLI
├── html/           The published guide, checker.js / fixer.js, the run-in-a-browser pages
├── website/
│   ├── llmtext/    llms-full.txt · llmdetailed.txt · llms-reporting.txt
│   └── viewers/    the model viewers
└── examples/       Sample models
```

`language/appwithai-language.json` is the canonical definition. Each subfolder
keeps its own copy for its own CI — `app-with-ai-tanstack/language/` is
byte-identical to this one, and `enterprise_reporting_tanstack/language/` is an
older fork under the name `erdwithai-language.json`. **When any of them disagrees
with the root copy, the root copy is the language.**

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
bun run check            # models, types, lint, and every stack generating
```

| | |
|---|---|
| `check:models` | Every model in `language/examples/` and `examples/` checks clean, and `html/models/` is still byte-identical to its counterpart |
| `type-check:language` | `language/**` under the strict config |
| `lint` | Biome over `language/` and `scripts/` |
| `check:stacks` | All three `--stack` targets actually generate |

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
