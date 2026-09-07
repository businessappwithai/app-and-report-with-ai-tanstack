# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Manager Rule

**CRITICAL**: Always use `bun`. NEVER use `npm` or `pnpm`.
- Exception: `appwithai-wasm` generated apps use `npm` — that's intentional.

---

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool,
FIRST, before any other tool. When in doubt, invoke the skill.

| Request | Skill |
|---------|-------|
| Product ideas / brainstorming | `/office-hours` |
| Strategy / scope | `/plan-ceo-review` |
| Architecture | `/plan-eng-review` |
| Design system / plan review | `/design-consultation` or `/plan-design-review` |
| Full review pipeline | `/autoplan` |
| Bugs / errors | `/investigate` |
| QA / testing site behavior | `/qa` or `/qa-only` |
| Code review / diff check | `/review` |
| Visual polish | `/design-review` |
| Ship / deploy / PR | `/ship` or `/land-and-deploy` |
| Docs after shipping | `/document-release` |
| Save progress | `/context-save` |
| Resume context | `/context-restore` |
| Author a backlog-ready spec/issue | `/spec` |

Use `/browse` for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

---

# APPWITHAI

**Project**: AI-powered ERD design + full-stack code generation  
**Version**: 5.1.1 | **Runtime**: Bun.js 1.4.0 (pinned — see below)

## Commands

| Command | Purpose |
|---------|---------|
| `bun run dev` | Web app → http://localhost:3000 |
| `bun run dev:mastra` | Mastra AI → http://localhost:4111 |
| `./scripts/start-llm.sh` | Local model server → :8000 |
| `bun run build` | Build all packages |
| `bun run type-check` | TypeScript (root tsconfig only) |
| `bun run type-check:language` | Type-check `language/**` (separate config) |
| `bun run lint` / `bun run lint:fix` | Biome lint / autofix |
| `bun run test` | Vitest unit tests (runs `packages/web/vitest.config.ts`) |
| `bun run test:e2e:server` | Playwright E2E with server startup |
| `bun run test:wasm` | WASM stack end-to-end |
| `bun run seed:admin -- --email you@example.com` | Run migrations + make admin |
| `bun run wasm generate -i <model> -o <dir>` | Generate NestJS/TanStack on WASM Postgres |
| `bun run wasm generate … --standalone` | Self-contained browser app |
| `bun run build:wasm-runtime` | Re-inline `templates/wasm/**` after editing |
| `bun run build:wasm-browser` | Rebuild `html/assets/appwithai-wasm.js` + `html/wasm-app/sw.js` |
| `bun run build:fullstack-browser` | Rebuild `html/assets/appwithai-fullstack.js` |
| `bun run build:language-tools` | Rebuild `html/checker.js` + `html/fixer.js` |
| `bun run test:language-tools` | The published `checker.js`/`fixer.js` still agree with the CLI |
| `bun run build:viewers` | Rebuild `website/viewers/eml-model.js` (the model viewers' reader) |
| `bun run test:llmtext` | Hold `website/llmtext/*.txt` to what the checker actually does, and the viewer claims in them |
| `bun run vendor:pglite` | Put PGlite beside `html/` (the wasm E2E job needs it) |
| `bun run build:stack-templates` | Put the stack templates beside `run-real-stack.html` |

**Run a single test:**
```bash
bun --filter @appwithai/web test -- path/to/file.spec.ts
bunx playwright test tests/e2e/specific.e2e.spec.ts
```

### Run `bun install` first — both failure modes are silent

In a tree with no `node_modules`, the two commands you would reach for to check
your work lie to you, in opposite directions:

| Command | What it does with no `node_modules` |
|---|---|
| `bunx biome check .` | Resolves **`biome@0.3.3`** — an unrelated legacy package, not `@biomejs/biome` — and exits **0 having checked nothing**. Indistinguishable from a clean lint |
| `bun run type-check` | Reports **thousands of phantom errors**: every `node:` builtin and `process` is unresolvable. Indistinguishable from a broken repository |

Both have been mistaken for real results, and each wasted a CI cycle. `bun
install` fixes both. If you cannot install, pin the linter explicitly —
`bunx @biomejs/biome@2.5.6 check .` — and do not trust `type-check` at all.

### The committed build artifacts, and why CI is the only judge of them

Eight files are built from sources and committed, and CI rebuilds each one and
compares byte for byte. Editing a source without rebuilding fails the
`Type-check, lint and unit tests` job — after type-check, lint and the unit
tests have all passed, which is a long way to walk to find out.

| Rebuild with | Artifact | Stale when you edit |
|---|---|---|
| `build:wasm-runtime` | `runtime-assets.generated.ts`, `overlay-assets.generated.ts` | `templates/wasm/**`, `templates/wasm-overlay/**` |
| `build:wasm-browser` | `html/assets/appwithai-wasm.js`, `html/wasm-app/sw.js` | the standalone generator, or the service worker |
| `build:fullstack-browser` | `html/assets/appwithai-fullstack.js` | **anything the real pipeline reaches** — `packages/generator/src/{rules,hooks,workflows,templates,parsers,rbac}/**` included |
| `build:language-tools` | `html/checker.js`, `html/fixer.js` | `language/**` |
| `build:viewers` | `website/viewers/eml-model.js` | `language/**`, and the parser, compilers, RBAC and `viewers/` under `packages/generator/src` |

`build:fullstack-browser` is the one that catches people out: it inlines the
whole NestJS + TanStack pipeline over a memory filesystem, so a change anywhere
under `packages/generator/src` can stale it even when nothing browser-facing was
touched.

**The two kinds are not equally portable.** `runtime-assets.generated.ts`,
`overlay-assets.generated.ts` and `sw.js` are verbatim copies — byte-identical
anywhere. The `.js` bundles come from `Bun.build`, whose output depends on the
bun version **and the platform**: the full-stack bundle is 807407 bytes built on
macOS and 807697 on Linux, same bun 1.4.0, same frozen lockfile. CI builds with
the `BUN_VERSION` pinned in `.github/workflows/ci.yml` on `linux-x64`, so
rebuilding a bundle anywhere else commits bytes CI will reject.

Run `--check` before pushing, and read what it says — it compares your runtime
and platform against CI's and tells you which case you are in rather than just
"out of date":

```bash
bun run build:wasm-runtime -- --check
bun run build:fullstack-browser --check
bun run build:wasm-browser -- --check
bun run build:language-tools --check
bun run build:viewers --check
```

Two traps worth knowing. The job's steps **fail fast**, so the first stale
artifact hides the rest — run all five locally or you will fix one per CI cycle.
And if `--check` reports your runtime differs from CI's, do not rebuild locally:
build where CI builds, e.g.
`docker run --rm -v "$PWD":/w -w /w oven/bun:1.4.0 sh -c 'bun install --frozen-lockfile && bun run build:fullstack-browser'`.

### `bun run dev` builds the workspace packages first
`packages/web` imports `@appwithai/core`, `@appwithai/generator` and
`@appwithai/ai` by bare specifier, and their `exports` point at `dist/`. On a
tree that has never been built those do not exist, so `dev` runs
`scripts/ensure-packages-built.ts` first. It builds only what is missing — 26ms
and nothing rebuilt on a warm tree. Editing `packages/core` mid-session still
needs `bun run build:core`.

### Known-broken scripts
All of the entries that used to be here have been **removed** rather than
documented: `migrate`, `test:app`, `test:e2e`, `test:generator`, `test:complete`
and `setup:gstack` pointed at files that do not exist, the root
`vitest.config.ts` referenced a missing `./test/setup.ts`, and `packages/web`'s
`lint` ran eslint, which is not a dependency anywhere (it runs Biome now). A
script that has never worked is worse than no script: it costs every new reader
the time to find out.

One remains, and it is not ours to fix here:
- `bun run build && bun run start` — the **production server does not work**.
  With a reachable `DATABASE_URL` it loads `@ag-ui/mcp-apps-middleware`, which
  `require()`s the ESM-only `eventsource` through the MCP SDK; Bun refuses, and
  the server answers 204 to everything including `/api/health`. Predates this
  work and reproduces on `main`. It is why the E2E suite drives `bun run dev`

### What `type-check` does NOT cover
- `language/**` → `bun run type-check:language`
- Templates (`packages/generator/templates/**`) → generate an app and build it

### What CI runs, and what each job is there to catch

`.github/workflows/ci.yml` runs four jobs on every pull request. Only the first
is reproducible from a plain `bun run` — the other three generate an application
and then use it, which is the whole point: type-checking *this* repository says
nothing about whether a generated one compiles.

| Job | What it does that nothing else does |
|---|---|
| **Type-check, lint and unit tests** | Also the four `--check` artifact comparisons, `test:language-tools` and `test:llmtext`. Lint is `--diagnostic-level=error` only — the tree carries several hundred pre-existing style warnings |
| **Generate a browser application and run its backend** | Generates the stack twice (with and without the overlay) and diffs; asserts the overlay's exact footprint; asserts **no `bun`/`bunx` survives** in any generated `package.json`; migrates and seeds on WebAssembly Postgres with no Postgres on the runner |
| **Drive the browser stack in Chromium** | The only job that *opens* the result — Service Worker, Node-API shim, worker host |
| **Generate an application and build it** | Builds the generated backend **and** frontend, type-checks the generated `tests/`, then runs that suite against real Postgres (pgvector) with `node run.ts --no-server` |

Two details of the last job worth copying locally when reproducing a failure: it
generates from `examples/drug-discovery.eml.mmd` with `--records-per-entity 25`,
and it runs the suite via the generator's own `run.ts`, never `bun test` — the
suites are ordered and stateful, and running them in one parallel process makes
failures move around between runs.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun.js 1.4.0 (pinned) |
| AI Orchestration | Mastra.ai v1.59+, CopilotKit v1.68+ |
| AI Model | Local OpenAI-compatible endpoint (:8000) |
| Retrieval | `@mastra/pg` PgVector (HNSW) |
| Frontend | TanStack Start v1.168, TanStack Router v1.170, Vite 8, React 19, Tailwind CSS v4, Zustand 5 |
| Rules | `@gorules/zen-engine` + `@gorules/jdm-editor` |
| Auth | Better Auth + custom session routes |
| Backend (generated) | NestJS 10+, Fastify, Kysely |
| Database | PostgreSQL via Kysely + `pg`; LibSQL/SQLite for Mastra |
| Testing | Vitest 4, Playwright 1.62, `node:test` (generated apps) |
| Linter | **Biome** |

---

## AI Model Configuration

**No Anthropic API** — `ANTHROPIC_API_KEY` is dead config. All AI config in `packages/ai/src/config.ts`.

**Never hard-code model strings or base URLs.** Import `mastraModelConfig` from `../config`.

```ts
export const AI_BASE_URL = process.env.LOCAL_AI_BASE_URL ?? "http://127.0.0.1:8000/v1";
export const AI_MODEL    = process.env.LOCAL_AI_MODEL    ?? "mlx-community/Qwen3.8-27B-4bit";
export const mastraModelConfig = { id: `openai/${AI_MODEL}`, url: AI_BASE_URL, apiKey: "local" };
```

---

## Monorepo Structure

```
app-with-ai-tanstack/
├── packages/
│   ├── core/       # Types, hooks, services, auth, rules, workflow, config
│   ├── generator/  # Code generation engine, CLI, Handlebars templates
│   ├── ai/         # Mastra.ai agents, workflows, converter, RAG
│   └── web/        # TanStack Start app (Vite 8 + React 19)
├── language/       # EML modeling language + `eml` CLI
├── database/       # Migrations (001–010)
├── html/           # Static guide + run-in-browser.html + run-real-stack.html
├── website/        # What businessappwithai.github.io publishes from here
│   ├── llmtext/    #   llms-full.txt and llmdetailed.txt
│   └── viewers/    #   The model viewers — served at appwithai.org/viewers
├── tests/          # Playwright E2E suites
└── examples/       # Sample .eml.mmd files
```

### Package Aliases

| Alias | Resolves to |
|-------|-------------|
| `@appwithai/core` | `packages/core/src` |
| `@appwithai/generator` | `packages/generator/src` |
| `@appwithai/ai` | `packages/ai/src` |
| `@appwithai/web` | `packages/web/src` |
| `@/*` or `#/*` | `packages/web/src/*` |

Adding a new subdir to core requires an `exports` entry **and** a `bun build` step in `packages/core/package.json`.

---

## Key Architecture

### Generation pipeline

`packages/generator/src/pipeline/generate-application.ts` is the **single generation path** — both the `appwithai` CLI and `/api/generate` go through it. One stack is supported: `tanstackjs-nestjs`. Generated apps listen on frontend:4000 / backend:4001 (off 3000 where the modelling tool runs).

**Adding a migration to generated backend:** write template under `templates/tanstack-start-nestjs/backend/src/migrations/`, then **add its slug to the `scaffold` array** in `generateMigrations` in `nestjs-backend.generator.ts` — nothing scans that directory. A template that is not in that array is simply never run, and the seeds that need its tables fail. Verify with `bun run db:setup`.

### Every directive parser anchors at `^%%`

A `%%` line is either a directive or prose, and the language promises prose is
inert. A parser that searches for `%%hook` *anywhere* in a line compiled a
comment that merely mentioned a hook into a real one. Match `^%%<keyword>` —
`hooks/index.ts` allows a run of them (`^%%+hook`) because older generated
flowcharts emitted `%%%%hook`, but it is still an anchor. `rules/index.ts` and
`workflows/steps.ts` do the same for `%%action` and `%%step`; a new parser that
does not will silently compile documentation.

### EML's vocabulary is not the runtime's — the generator translates

`%%action` names an intent in EML's words; the generated rules engine reads its
own union (`RuleAction["type"]` in `rules-engine.service.ts`), which is the
vocabulary the in-app rule editor already writes. Where the two differ,
`packages/generator/src/rules/index.ts` is what converts — a row written in the
wrong vocabulary still *matches*, is handed to both readers, and is dropped by
each, so the failure is silent rather than an error:

| EML writes | Runtime reads | Why the gap matters |
|---|---|---|
| `validation-error` | `prevent` | `validate()` rejects on `prevent`; an untranslated row let every write through |
| `transform field: … value: …` | one `transformData` object | The executor skips a transform that arrives with none (`field`/`value` are kept beside it for the table editor to display) |
| `trigger-workflow` | `trigger-workflow` | Already matches — which is why sagas fired while the rules around them did not |

When adding an action type, change both ends and the translation, and assert the
compiled row against the runtime's union — not against the compiler's own output.

### Seeds honour the model's `%%enum`

The `seedValue` helper in `packages/generator/src/templates/loader.ts` takes the
column's declared enum values and, when there are any, picks from **those**
before any of its generic guesses. Without it the seeder wrote its own words
("Active", "Pending") into every `status` column: the rows contradicted the
application's own dictionary, every state machine was dead on them because the
guard finds no edge out of a state the model never declared, and every rule
keyed on a real status value never fired. A generated application could not
demonstrate the workflows it was generated from.

### State machines

`%%workflow … kind: state` compiles to rows in `sys_workflow_transitions`, seeded by `05b_workflow_transitions.ts`. `entity-access.guard.ts` reads them and refuses a status write with no matching edge — **for every caller, master role included**: an edge the diagram never drew is not a permission an administrator lacks, it is a move that does not exist. Who may cross an edge is the separate question, answered from `sys_transition_access` — compiled from `%%rbac` by `packages/generator/src/rbac/index.ts`, **not** from `%%guard`, which now means only an automation condition — and *that* one the master role does bypass. Keep the two apart; merging them is how topology enforcement came to run only on edges that happened to carry a role rule.

`GET /api/workflows/transitions?table=&from=` exposes the edges, so a screen can offer only the moves that exist.

### WASM stack

`appwithai-wasm` runs the same pipeline as `appwithai`, then applies an overlay replacing `pg` with WebAssembly Postgres and swapping `bun` for `node`. The overlay changes exactly 9 files and adds 6 — CI asserts this footprint exactly. **After editing `templates/wasm/` or `templates/wasm-overlay/`, run `bun run build:wasm-runtime` from repo root.**

`--standalone` mode generates a self-contained browser app (model compiled to `model.json` + SQL, no per-entity source). Regular mode generates the full NestJS + TanStack stack (~413 files).

### `docker compose up --build` — the three things that have to hold

The generated project ships two ways to run: `Dockerfile` at the root builds the
whole application into one image, and `backend/Dockerfile` + `frontend/Dockerfile`
build the split pair the compose file uses by default. **The default is the
split pair, so that is the path that has to work** — and each of these three
broke it in a way that reads like something else:

| What | Why it is not obvious |
|---|---|
| **Both service Dockerfiles `COPY . .` before installing** | The root manifest is a workspace root naming `backend`, `frontend` *and* `tests`. Copying the three manifests alone — the usual cache trick — fails with `Workspace not found "tests"`, which reads like a missing file rather than a missing directory. The root Dockerfile already knew this; the service pair did not |
| **`backend/run-app.sh` runs `bun run migrate` before starting** | Nothing else in the split build does. `docker-start.sh` covers the single image; the `backend` service had no equivalent, so a fresh volume gave a backend that died on `relation "sys_system" does not exist` and compose reported only "container is unhealthy". `migrate` runs the seeds too, and both halves are idempotent |
| **Every health check probes `127.0.0.1`, never `localhost`** | Inside the container `localhost` resolves to `::1` as well, busybox `wget` tries that first, and the API listens on IPv4 only. The probe answers "connection refused" against a server that returns 200 to the host — the backend never goes healthy, and the front end, which waits on it, never starts |

Two consequences worth knowing. `COPY . .` means **any** file change invalidates
the install layer, so a rebuild is a full rebuild — that is the price of an
install that works at all. And both runtime stages copy the pruned
`node_modules` out of the builder rather than re-installing, for the same
workspace reason: the runtime stage has no `tests` directory to install against.

Both images also carry `model/model.eml.mmd`. Without it the model-context
assistant logs `No model/model.eml.mmd shipped with this application` on every
start and answers nothing.

### Project wizard flow

```
init → design → logic → generate → enhance → deploy
```

Step vocabulary lives in `packages/web/src/types/project.ts` (`ProjectStep`, `STEP_ORDER`, `STEP_LABELS`, `STEP_ROUTES`). `ProgressStepper` derives itself from there — **add a step in one place only**.

### Web app (packages/web/)

**No Vinxi** — `vite.config.ts` shims `@tanstack/start-api-routes` with `src/lib/start-api-routes-compat.js`. Also loads the root `.env` via `loadEnv` (Vite runs with cwd `packages/web`).

### The automation builder — the second reader of the same directives

`packages/web/src/lib/automation/model.ts` reads and writes a subset of EML
directly, and it is not the generator. An automation is one sentence — a
trigger, a flat list of conditions that must all pass, an ordered list of steps
— and it round-trips through the same mermaid flowchart with `%%` directives the
generator's parsers read, so an automation saved before the builder existed
still opens and anything saved in it still runs.

Four directives therefore have two forms and two consumers. Change one and check
the other:

| Directive | Generator form | Automation form |
|---|---|---|
| `%%hook` | `%%hook <type> <handler> on <Entity>` → a lifecycle handler module | `%%hook <type> on <Entity>` (no handler) → the automation's trigger |
| `%%workflow` | `%%workflow <name> entity: … kind: …` | `%%workflow name: <name>`, entity taken from the `%%hook` line |
| `%%guard` | *nothing* — the RBAC sense it used to carry is `%%rbac` now | `%%guard <field> <op> <json>` → an automation condition |
| `%%loop` | saga compiler | repeat-while, bounded by the author's `max:`, no nesting |

Whatever the builder can write, `language/checker.ts` must accept — a checker
that rejects the application's own output discredits both. That pairing is held
by `packages/web/src/lib/automation/__tests__/checker-accepts-automations.test.ts`.

### AI package (packages/ai/)

Mastra instance (`src/mastra/index.ts`) registers `codeAgent` only. The four agents in `src/agents/*` are used directly by the converter and ERD workflow — not on the Mastra instance. RAG uses one pgvector HNSW index (`model_context`) keyed by `projectId`; spec chunks use `SPEC_PROJECT_ID = "__eml_spec__"`.

---

## TanStack Start API Routes

This section is about **`packages/web`**, the modelling tool. The generated
frontend's `/api` proxy routes are a different convention on an older TanStack
version — see below — and must not be "fixed" to match this one.

Use `createFileRoute` + `server.handlers`. **NOT** `createAPIFileRoute` (deprecated).

```typescript
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/projects/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { getDatabase } = await import("@appwithai/core/services"); // lazy import!
        const db = getDatabase();
        // ...
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
```

Rules:
- Lazy-`import()` server-only modules inside handler body (keeps them out of client bundle)
- Always return `Response` with explicit `Content-Type`
- **Every route touching a project must call `requireProjectAccess`**
- Dynamic segments: `$id`, `$serviceName` (not `[id]`)
- Flat-file segments use `.`: `api/projects/$id/eml.download.ts` → `/api/projects/$id/eml/download`
- Never edit `routeTree.gen.ts` by hand

**Env vars:** Client components use `import.meta.env.VITE_*`; server handlers use `process.env.*`.

### The generated app's `/api` proxy routes export the same call twice

Three templates — `frontend/src/routes/api/{$,auth/$,copilotkit/$}.ts.hbs` — proxy
the browser to the NestJS backend, and each ends with two exports built from one
shared, **non-exported** `handlers` object:

```ts
const handlers = { GET: handler("GET"), /* … */ }

export const Route = createAPIFileRoute("/api/$")(handlers)
export const APIRoute = createAPIFileRoute("/api/$")(handlers)
```

Neither may be an alias of the other, and both must exist. Two readers want
opposite things:

- The **route-tree generator** requires `Route` to be initialised by a call
  expression directly. Assign it from a local const and the generate fails with
  `expected "Route" export to be initialized by a CallExpression`, leaving no
  `routeTree.gen.ts` — which every route file imports, so the frontend does not
  type-check at all.
- The **dev server** imports the file as `?pick=APIRoute`, which strips every
  other export. An `APIRoute` written as `= Route` then points at a binding that
  is gone and throws `ReferenceError: Route is not defined` at import — every
  `/api` call answers 500, sign-in included, while the backend is perfectly
  healthy and answering the same request with 200.

The router also registers an API route file by its `APIRoute` export alone, so a
file exporting only `Route` is silently absent and answers with the HTML of a
missing page rather than a recognisable 404. Held by
`packages/generator/src/templates/__tests__/api-route-exports.test.ts`.

---

## Logging

**`packages/core/src/logging/log-spec.json` is the single source of truth.** Levels,
channels, messages and redaction are declared there; a call site names an event
and the spec decides the rest.

```ts
import { getLogger } from "@appwithai/core/logging";
getLogger("pipeline").event("pipeline.generation.completed", { project, files, durationMs });
```

Never write a level and a sentence at a call site. Naming the event keeps one
line per event in the catalogue, makes it greppable, and lets a test assert a
failure was reported without knowing its wording. Adding a log line means adding
an entry to the spec first.

| Rule | Why |
|---|---|
| Channels declare the level of their **least severe event** | Resolution takes the *quieter* of channel and environment, so no channel can be louder than its environment permits |
| `LOG_LEVEL` / `LOG_LEVEL_<CHANNEL>` override both | One subsystem turned up at 3am without a redeploy |
| stdout only, `sync: false` in production | Whatever runs the process collects it; a syscall per line is not free |
| An unknown event id is reported at `warn`, not dropped | A typo must not become silence |
| Never log a request body, a query string, or a field's value | Business data and credentials. `changedFields` logs the *keys* |

Two checks hold it together, both in `packages/core/src/logging/__tests__/`:
`logger.test.ts` reads the JSON actually written rather than spying on Pino, and
`spec-conformance.test.ts` asserts every `.event(…)` in the tree names a declared
id **and** that the spec declares nothing that nothing emits.

### The pipeline takes a logger; it does not import one

`build:fullstack-browser` bundles the pipeline for a browser tab, where Pino
cannot run. So `generate-application.ts` depends on the one-method
`PipelineLogger` port (`pipeline/logger-port.ts`) that `ChannelLogger` satisfies
structurally: Node passes the real logger, the browser passes `NO_LOG`. **Never
import `@appwithai/core/logging` from anything the browser bundle reaches** —
`bun run build:fullstack-browser` then fails, and `grep pino html/assets/appwithai-fullstack.js`
must stay at zero.

A CLI run is silent unless `LOG_LEVEL` is set (`cliLogger`): a terminal's stdout
is its report to the person watching, and interleaving JSON through it helps
nobody. The `/api/generate` path always logs.

### The generated application

Ships its own copy, derived from the canonical spec by
`packages/generator/src/logging/generated-spec.ts` — **not** a template, so the
two cannot drift. Channels not marked `generated` are filtered out.

- `backend/src/common/logging/logger.service.ts` — Pino, the Nest `LoggerService`
  adapter, `installHttpLogging`, `installProcessLogging`, and the
  `AsyncLocalStorage` request context.
- The spec is **read off disk**, and `nest-cli.json` copies it into `dist/src/`
  as a build asset. An imported JSON would be inlined and the deployed file
  would be decorative.
- **HTTP logging is a Fastify `onResponse` hook, never a Nest interceptor.**
  Interceptors run after guards, so an interceptor sees no 401 or 403 and none
  of the better-auth routes. This is the mistake to not make twice.
- The exception filter stashes its exception on the request (`__logError`) for
  that hook — the hook sees every response, the filter sees the error.
- `requestId` and `userId` come from the request context, so a service never
  takes a user it has no other use for.

---

## Database

PostgreSQL via Kysely. **One connection site:** `packages/core/src/config/db.config.ts`.

```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
# or: PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE
```

Migrations applied via `runMigrations()` from `@appwithai/core/services`. pgvector required for model-context assistant.

---

## Security Patterns

### Project access
**Every route touching a project must call `requireProjectAccess`.**

```typescript
import { requireProjectAccess } from "@/lib/project-access";
const access = await requireProjectAccess(request, params.id, "read_write");
if ("response" in access) return access.response;  // 401 / 403 / 404
```

### Three routes are public; every other one is guarded
`auth/login`, `auth/register` and `health` answer without a session. Everything
else under `packages/web/src/routes/api` calls `requireProjectAccess` or
`requireUser` before it does anything — and
`tests/e2e/02b-unauthenticated-surface.e2e.spec.ts` proves it by reading the
route directory, working out each file's path and verbs, and driving all of
them with no session. It keeps no list, so a route added tomorrow is covered
tomorrow.

### Routes that are not about one project
`requireProjectAccess` has no answer for the rules store, the workflow-run log,
or the admin read models — and those were left with no check at all, so an
anonymous request could list every business rule in the installation, rewrite
one, or delete it. A rule decides whether a write is refused, so that is control
over what the application permits, not a listing of metadata.

```typescript
import { requireUser } from "@/lib/require-user";
const caller = await requireUser(request, "rules", "write");
if (caller.response) return caller.response;      // 401
```

### A streaming route settles access before the stream opens
`/api/generate` and `/api/deploy` answer as server-sent events. A refusal
written as an SSE frame arrives inside a 200 — by which point the caller has
already been given the generation, or the `docker build`. Read the body, resolve
the project, `requireProjectAccess`, and only then construct the stream.

### Rate limiting
```typescript
const { AUTH_LOGIN_LIMIT, enforceRateLimit } = await import("@/lib/rate-limit");
const limited = enforceRateLimit(request, "auth:login", AUTH_LOGIN_LIMIT);
if (limited) return limited;
```

### A listing has no single project to ask about
`requireProjectAccess` answers "may I touch this project". A route that lists
across projects — the diagram library's `GET /api/mermaid` with no `projectId` —
has no such question to ask, and serving the whole table for the client to
filter is how that endpoint came to hand every project's diagrams to anybody.
`accessibleProjectIds(userId)` in `project-access.ts` is the other half: the
ids this caller owns or is a member of.

### An id in the path names the thing; the path names whose it is
`erd_versions` is reached as `/api/projects/:id/erd-versions/:versionId/...`,
and the handler resolved the version by id alone. The access check passed —
against the project in the URL — and the write then landed on whichever project
the *version* belonged to: a caller with write access to one project could roll
back, or permanently delete, another project's history. Scope the lookup to the
project as well as the id, in the service rather than the route, so a caller of
the service cannot forget.

---

## Code Style

**TypeScript strict flags:** `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess` (every index → `T | undefined`, narrow before use), `noImplicitReturns`, `isolatedModules`, `experimentalDecorators`.

**Biome:** 2-space indent, LF, line width 100, double quotes, semicolons always, ES5 trailing commas. Excluded: `packages/generator/templates`, `**/routeTree.gen.ts`, `**/*.generated.ts`, `html/assets/`.

**Naming:** functions→camelCase, Types/Classes→PascalCase, primitive constants→UPPER_SNAKE_CASE, instance constants→camelCase, logic files→kebab-case, React component files→PascalCase.

---

## Environment Variables

**AI:** `LOCAL_AI_BASE_URL` (:8000/v1), `LOCAL_AI_MODEL`, `LOCAL_AI_EMBEDDING_MODEL`, `LOCAL_AI_EMBEDDING_DIMENSIONS` (384)

**Database:** `DATABASE_URL` or `PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE`

**Web (client must use `VITE_`):** `VITE_APP_URL` (:3000), `VITE_API_URL`, `VITE_MASTRA_URL` (:4111)

**Security:** `SESSION_SECRET`, `JWT_SECRET`, `DB_ENCRYPTION_KEY` (base64, 32 bytes)

**Logging:** `LOG_LEVEL`, `LOG_LEVEL_<CHANNEL>` (e.g. `LOG_LEVEL_DB`), `LOG_PRETTY`,
`LOG_SYNC`, `LOG_NAME`, `DB_SLOW_QUERY_MS` (500), `HTTP_SLOW_REQUEST_MS` (1000)

**Mastra:** `MASTRA_DATABASE_URL` (default `file:./appwithai-mastra.db`), `MASTRA_PORT` (4111)

---

## EML Language

EML is a Mermaid-based language for ERD + business rules + workflows in one `.eml.mmd` file. `language/appwithai-language.json` is the **single source of truth**.

```bash
bun language/checker.ts language/examples/crm.eml.mmd   # validates, writes .error file
bun language/fixer.ts   language/examples/crm.eml.mmd.error
```

The checker always writes the `.error` file — revert it unless the verdict changed.

**The fifteen directives** (`%%` comments Mermaid ignores):
- structure: `%%meta`, `%%entity`, `%%field`, `%%enum`, `%%index`, `%%category`
- behaviour: `%%rule`, `%%workflow`, `%%step`, `%%loop`, `%%trigger`, `%%action`, `%%hook`
- access: `%%rbac`
- automation condition: `%%guard`

`%%guard` is the one that moved. It used to mean a role restriction; that sense
is `%%rbac` now, and `%%guard` means only an automation's condition
(`%%guard <field> <op> <json>`). A reader meeting the old RBAC shape under this
keyword skips it rather than reading `role:admin` as a condition on a field
called `role`.

Each directive's `status` in `appwithai-language.json` says whether it is
`compiled` (something reads it and emits code) or only `validated` (the checker
knows it; nothing generates from it yet) — check that before assuming a
directive has an effect. `%%rule` and `%%trigger` are `validated`.

**When changing language semantics:** edit `appwithai-language.json` first, then spec docs, grammar, parser, composer, rag. If adding a diagnostic, add its code to `AUTO_FIXABLE_CODES` in `checker.ts`, the fixer's dispatch table, and `diagnostics.autoFixable` in the JSON — all three.

**Example models are checked in twice** — `language/examples/*.eml.mmd` and `html/models/*.eml.mmd` must be byte-identical (CI asserts this).

---

## Testing

### Unit tests
Effective config: `packages/web/vitest.config.ts`. Its `include` reaches into
`../core`, `../generator` and `../ai` — and **nowhere else**. `language/**` has
no unit tests and is not covered by `bun run test`; what holds it is
`bun run type-check:language`, `bun run test:language-tools` (the published
`checker.js`/`fixer.js` still agree with the CLI) and `bun run test:llmtext`.

Regression tests for generator behaviour live beside the code they cover, as
`src/**/__tests__/*.{test,spec}.ts`, and each is named for the thing that broke:
`rules/__tests__/action-vocabulary`, `hooks/__tests__/compile-hooks`,
`workflows/__tests__/compile-sagas`, `templates/__tests__/api-route-exports`,
`templates/__tests__/seed-enum-values`.

`tests/test-data/dance-studio-workflows.eml.mmd` is the fixture that carries all
25 behaviour constructs in one model — reach for it when changing a parser,
compiler or the checker, because it is the only document that exercises the
whole behaviour surface at once.

### The modelling tool's E2E suite
`bunx playwright test` (or `bun run test:e2e:server` — same thing now). Playwright
starts the server itself and stops it; there is no script to run first and no
port to line up. One value, `E2E_PORT`, feeds both the base URL and the server.

CI runs it as **Drive the modelling tool**, against a pgvector service, after
`bun run seed:admin` creates the schema and the bootstrap administrator the
suite signs in as.

| File | What it holds the app to |
|---|---|
| `01-auth` | Sign-in, sessions, sign-out, registration-needs-approval. Asserts the same answer for a wrong password and an unknown address — a different one is an account-enumeration oracle |
| `02-project-authorization` | Enumerates the project-scoped routes and drives each as nobody, a signed-in stranger, and the owner. **Found three endpoints serving unauthenticated callers on its first run**, and two more when `/workflows` was added to the list |
| `02b-unauthenticated-surface` | Every route file, its verbs read off the source, driven with no session. Keeps no list — which is the only version of this check that stays true |
| `03-projects` | The container: create, list, read, rename, delete; the fields a client may not set; search that does not reach another owner's projects |
| `04-model-and-versions` | Validate a document, save it, keep every save as a version, restore one, download it back. Also asserts the fixtures themselves pass `language/checker` |
| `05-automations` | The builder's own serialiser over HTTP: stored byte for byte, parsed back to the same automation, accepted by the checker |
| `06-rules-and-workflow-runs` | The decision-table store and the run log — including that neither answers a caller with no session |
| `07-sharing` | Read-only, read-write, upgraded and revoked shares. Every case is a pair: what the permission allows, and what it does not |
| `08-generation` | The wizard's generate step, asserted on what landed on disk rather than on what the stream said |
| `09-rate-limiting` | Runs last, deliberately: the limiter is a fixed window per IP, and exhausting it mid-suite left every later spec failing with an unrelated 429 |

Three things to know before adding to it:
- **Nothing runs as the administrator except the approval of new accounts.** The
  project routes refuse a caller whose role is `admin` outright ("Admins cannot
  modify projects"), so a spec that drove them as the bootstrap account would be
  asserting against 403s of its own making. `createUserSession` in `helpers.ts`
  registers, approves and signs in an ordinary account with its own cookie jar.
- **Every test shares one IP**, so the suite runs the server with
  `AUTH_LOGIN_MAX_PER_MINUTE` / `AUTH_REGISTER_MAX_PER_MINUTE` raised. Both
  default to their production values (10 and 3) everywhere else.
- **`02`'s route list is the weak part of the design.** A project-scoped route
  absent from `PROJECT_ROUTES` is not tested at all, which is exactly how
  `/api/projects/:id/workflows` came to serve both verbs to anybody. Add to it
  when you add a route. `02b` needs no such maintenance, but it only asks
  whether a route refuses an anonymous caller — `02` is still what says the
  refusal is the *right* one.

### Template testing
**Type-checking this repo says nothing about whether a generated app compiles** — templates are `.hbs` until rendered. Changing a template means generating an app and building it, not just `bun run type-check`.

### The generated app's own suite
Every generated application gets a `tests/` project driving its HTTP API — run it with `appwithai generate … --run-tests`, or `bun run test:e2e` inside the output. Suites are ordered by filename prefix: health, auth, dictionary (`02`, `02b` layout, `02c` references), CRUD per entity (`03`), bulk seed (`04`), rules per entity (`05`), workflows (`06`–`09`), benchmark and budgets (`10`, `11`).

`harness/model.ts` carries the model's own `%%enum` values and state-machine edges into the suites. Assert against **that**, not against the dictionary the same generator wrote — otherwise a suite only proves the application is self-consistent, and passes just as happily when the generator dropped something.

**What a per-entity suite asserts, and what it deliberately does not.** The CRUD
file drives behaviour rather than status codes: the sort is checked for
monotonicity on a *numeric* column (text ordering belongs to the database's
collation, and asserting it with a JavaScript comparator tests the comparator),
the filter is checked in both directions, pagination is checked for overlap, and
the replace is built from the record as it stands with one field changed —
because a payload invented by the factory has to satisfy the model's own rules
and state machine to be accepted, and a refusal there is the model working.

Three constraints are worth knowing before adding cases:

| Constraint | Why the obvious test is wrong |
|---|---|
| A record's state column | The factory invents a status like any other value; on an entity with a state machine that is a move the model may never have drawn, and the guard refuses it — correctly |
| The model's own `%%action` rules | A generated payload can trip one (a discount over 40 percent, in `crm`). Marker-value rules in `05-rules` exist so a refusal can only have come from the rule under test |
| Referential integrity | The migration emits a foreign-key constraint for a declared `oneToMany` relationship **and nothing else**, so a column the ERD marks `FK` but draws no line for — a `manager_id` resolved to `bus_user` by naming convention — is a reference the dictionary describes and the schema does not enforce. `constrainedForeignKey()` picks a column where the constraint exists |

The suites deliberately leave their rows behind, so **a re-run against a populated database is the normal case**. Unique values are salted with a per-run token (`E2E_RUN_TOKEN`, printed by the runner) folded into any caller-supplied salt; replacing it rather than folding into it makes every insert of the second run collide.

### WASM E2E
`tests/e2e/wasm/` has its own Playwright config (serves `html/` not the modelling
tool). It needs two things placed beside the page first, both generated rather
than committed: `bun run vendor:pglite` and `bun run build:stack-templates`.

---

## Key Files

| File | Purpose |
|------|---------|
| `packages/ai/src/config.ts` | ⭐ Central AI model + embedding config |
| `packages/core/src/logging/log-spec.json` | ⭐ The log specification, stated once |
| `packages/core/src/logging/logger.ts` | Pino, configured entirely from the spec |
| `packages/generator/src/pipeline/logger-port.ts` | ⭐ Why the pipeline never imports a logger |
| `packages/generator/src/logging/generated-spec.ts` | ⭐ The generated app's spec, derived not duplicated |
| `.../backend/src/common/logging/logger.service.ts.hbs` | ⭐ The generated app's logger + HTTP hook |
| `packages/core/src/config/db.config.ts` | ⭐ Sole DB connection site |
| `packages/core/src/hooks/hook-executor.ts` | `globalHookExecutor` |
| `packages/core/src/rules/rules-engine.service.ts` | GoRules evaluation |
| `packages/core/src/types/bus-entity.types.ts` | `identifierColumnNames` — display value rule |
| `packages/generator/src/pipeline/generate-application.ts` | ⭐ The one generation path |
| `packages/generator/src/pipeline/parse-model.ts` | ⭐ Model → parsed model; pure (no node:fs) |
| `packages/generator/src/rbac/roles.ts` | ⭐ `%%rbac` → roles + per-entity visibility; read by both stacks |
| `packages/generator/src/rules/index.ts` | ⭐ `%%action` → decision-table rows, in the *runtime's* vocabulary |
| `packages/generator/src/hooks/index.ts` | `%%hook` → lifecycle handler modules (anchored at `^%%`) |
| `packages/generator/src/workflows/steps.ts` | `%%step` / `%%loop` → executable saga steps |
| `packages/generator/src/templates/loader.ts` | Handlebars helpers, incl. the enum-aware `seedValue` |
| `packages/generator/src/manual/index.ts` | ⭐ Parsed model → `manual.html`; both stacks write it |
| `packages/generator/src/generators/ports.ts` | Generated-app default ports (4000/4001) |
| `packages/generator/src/generators/wasm/overlay.ts` | ⭐ What the WASM overlay may change — CI asserts footprint |
| `packages/generator/templates/common/design-tokens.json` | ⭐ The palette, stated once |
| `packages/generator/templates/wasm/` | ⭐ Standalone browser runtime — run `build:wasm-runtime` after editing |
| `.../backend/src/modules/auth/guards/entity-access.guard.ts.hbs` | ⭐ Topology first, then role access |
| `.../backend/src/modules/bus/bus.service.ts.hbs` | ⭐ `getEntityMetadata` — column → control |
| `packages/web/src/types/project.ts` | ⭐ Wizard step vocabulary |
| `packages/web/src/lib/automation/model.ts` | ⭐ The automation builder — second reader/writer of EML |
| `.../frontend/src/routes/api/$.ts.hbs` | ⭐ `Route` **and** `APIRoute`, two calls, neither an alias |
| `tests/test-data/dance-studio-workflows.eml.mmd` | The model carrying all 25 behaviour constructs |
| `.github/workflows/ci.yml` | ⭐ The four jobs that gate a PR |
| `packages/web/src/lib/project-access.ts` | ⭐ Project authorization |
| `packages/web/src/lib/require-user.ts` | ⭐ The same shape, for routes that are not about one project |
| `packages/web/vite.config.ts` | Vite config, root-.env loading, start-api-routes shim |
| `language/appwithai-language.json` | ⭐ EML canonical definition |
| `language/composer.ts` | ⭐ The only writer of complete EML documents |
| `website/llmtext/llms-full.txt` | ⭐ The spec written for language models |
| `website/llmtext/llmdetailed.txt` | The same spec, §10 replaced by the interactive authoring walkthrough |
| `packages/generator/src/viewers/view-model.ts` | ⭐ One reading of a model for the viewers — composed, never re-derived |
| `website/viewers/` | ⭐ The published model viewers. `eml-model.js` is built; the rest is hand-written |
| `scripts/ci/llmtext-claims.ts` | ⭐ Holds both specs, and their claims about the viewers, to the real code — run by CI |

---

## Common Task Checklists

### Add an API route
1. Create `packages/web/src/routes/api/…` with `createFileRoute` + `server.handlers`
2. Call `requireProjectAccess` if the route touches a project, `requireUser` if
   it does not — an unguarded route is the default, not the exception
3. Lazy-import server-only deps inside the handler
4. If it is project-scoped, add it to `PROJECT_ROUTES` in
   `tests/e2e/02-project-authorization.e2e.spec.ts`; that list is the only thing
   that notices a route nobody guarded

### Add a wizard step
1. Add to `ProjectStep`, `STEP_ORDER`, `STEP_LABELS`, `STEP_ROUTES` in `packages/web/src/types/project.ts`
2. Create `packages/web/src/routes/projects/$id/<step>.tsx`

### Add a generator input
Add once in `GenerationSettings` in `generate-application.ts`. Do NOT add at call sites.

### Change the browser runtime (`--standalone`)
1. Edit `packages/generator/templates/wasm/`
2. `bun run build:wasm-runtime` **from repo root**
3. Generate and test: `bun run wasm generate -i language/examples/crm.eml.mmd -o /tmp/x --standalone --force`
4. `bun run test:wasm` before pushing

### Add or change a `%%action` type
1. `packages/generator/src/rules/index.ts` — compile the row, translating to the
   runtime's `RuleAction["type"]` vocabulary (not EML's)
2. Check the generated `rules-engine.service.ts` reads it: `validate()` for a
   refusal, `SIDE_EFFECTING_ACTIONS` for a side effect
3. Assert the compiled row against the runtime's union in
   `src/rules/__tests__/action-vocabulary.test.ts` — never against the
   compiler's own output
4. `language/appwithai-language.json` if the EML spelling changes

### Add a directive parser
1. Anchor the pattern at `^%%+<keyword>\b` — never a bare `.includes()`, or
   prose that mentions the directive compiles into a real one
2. Check whether `packages/web/src/lib/automation/model.ts` reads the same
   keyword; four of them have two forms and two consumers
3. Add a case to `checker-accepts-automations.test.ts` if the builder can write it

### Change what `%%rbac` enforces
1. `packages/generator/src/rbac/roles.ts` (roles + visibility)
2. `packages/generator/src/rbac/index.ts` (compiler)
3. `templates/.../backend/src/migrations/011_add_operation_access.ts.hbs` (tables)
4. `templates/common/seeds/operation-access.ts.hbs` (seed)
5. `templates/.../auth/guards/entity-access.guard.ts.hbs` (enforcement)

### Add a migration to the generated backend
1. Write template under `templates/tanstack-start-nestjs/backend/src/migrations/`
2. **Add slug to `scaffold` array** in `generateMigrations` in `nestjs-backend.generator.ts`
3. Verify with `bun run db:setup` (not `bun run migrate`)

### Extend the EML language
1. Edit `language/appwithai-language.json` first
2. Update grammar, spec docs, parsers, composer, rag
3. Add diagnostic to all three places if auto-fixable
4. Run `bun run type-check:language`

### Touch a generated `/api` proxy route template
1. Keep both `Route` and `APIRoute`, each its own `createAPIFileRoute(...)` call
   over one shared non-exported `handlers` object — neither may alias the other
2. Regenerate an application and **sign in through a browser**; a 500 on
   `/api/auth/sign-in/email` with a healthy backend is this bug
3. `templates/__tests__/api-route-exports.test.ts` covers the export shape

### Add a log event
1. Declare it in `packages/core/src/logging/log-spec.json` — id, channel, level,
   message, fields. A channel must declare the level of its least severe event
2. Emit it with `getLogger(channel).event(id, fields)`; never a bare level and a
   sentence
3. If the generated application should emit it too, the channel's `surfaces`
   must include `generated` — and the call site is a `.hbs` template
4. `bun run test` — `spec-conformance.test.ts` fails on an undeclared id *and*
   on a declared event nothing emits

### Add a core subpath export
1. Create `packages/core/src/<dir>/index.ts`
2. Add `exports` entry + `bun build` step in `packages/core/package.json`
3. Add alias to root `tsconfig.json` and Vite/Vitest configs

---

## Git Workflow

1. Feature branch from `main`
2. `bun run type-check` and `bun run lint` before pushing
3. If you touched `packages/generator/templates/`, generate an app and build it
4. Target `main` for PRs
