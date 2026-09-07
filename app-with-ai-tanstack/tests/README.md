# Tests

Three suites, each with a different subject. They are separate because they need
different things running, not because they were written at different times.

| Suite | Subject | Run it |
|---|---|---|
| `packages/**/__tests__` | Units of the generator, core, ai and web | `bun run test` |
| `tests/e2e/*.e2e.spec.ts` | The **modelling tool** over HTTP and in a browser | `bunx playwright test` |
| `tests/e2e/wasm/` | The browser stack — Service Worker, Node-API shim, worker host | `bun run test:wasm` |

A fourth lives outside this directory: every **generated application** gets its
own `tests/` project driving its HTTP API. Run it with
`appwithai generate … --run-tests`, or `node run.ts` inside the output. CI runs
it against a real PostgreSQL, which is the only check that says whether the
templates render code that actually works.

## The modelling tool's suite

Playwright starts the server and stops it; there is nothing to run first. One
value, `E2E_PORT`, feeds both the base URL and the server.

```bash
bunx playwright test                      # everything
bunx playwright test tests/e2e/01-auth.e2e.spec.ts
```

It needs PostgreSQL and the bootstrap administrator: `bun run seed:admin`.

| File | Holds the app to |
|---|---|
| `01-auth` | Sign-in, sessions, sign-out, approval-gated registration |
| `02-project-authorization` | Every project-scoped route, driven as nobody, a signed-in stranger, and the owner |
| `02b-unauthenticated-surface` | Every route file in the tree, driven with no session. Reads the directory rather than keeping a list |
| `03-projects` | Creating, listing, reading, renaming and deleting a project, and the fields a client may not set |
| `04-model-and-versions` | Validating a document, saving it, its version history, restoring, downloading, and the diagram library |
| `05-automations` | The automation builder's serialiser over HTTP, round-tripped and handed to the language checker |
| `06-rules-and-workflow-runs` | The decision-table store and the workflow-run log |
| `07-sharing` | Read-only, read-write, upgraded and revoked shares |
| `08-generation` | The generate step, asserted on the files it wrote |
| `09-rate-limiting` | Runs last, because exhausting the limiter mid-suite breaks everything after it |

Three things to know before adding to it:

- **Nothing but account approval runs as the administrator.** The project routes
  refuse a caller whose role is `admin`, so specs drive an ordinary approved
  account — `createUserSession` in `helpers.ts` makes one, with its own jar.
- **Every test shares one IP.** The suite runs the server with
  `AUTH_LOGIN_MAX_PER_MINUTE` and `AUTH_REGISTER_MAX_PER_MINUTE` raised; both
  default to their production values (10 and 3) everywhere else.
- **Tests leave their rows behind.** There is no teardown, and a re-run against
  a populated database is the normal case, so anything that has to be unique
  goes through `unique()` in `helpers.ts`.

## Fixtures

`test-data/dance-studio-workflows.eml.mmd` is the model carrying all 25
behaviour constructs. Reach for it when changing a parser, a compiler or the
checker — it is the only document that exercises the whole behaviour surface at
once.

## What used to be here

A `complete-tests/` directory, a `scripts/` directory of shell runners, and two
extra Playwright configs, all testing "Option 1 (Next.js + NestJS)" and
"Option 2 (OData + OpenUI5)". The generator emits one stack now, and none of
those files could run: they drove servers nothing starts, on ports nothing
serves, against stacks that no longer exist. They were removed rather than
left to look like coverage.

The one thing worth rebuilding from them was **sharing**, and `07-sharing` is
it: a read-only share (visible, writes refused), a read-write share (writes
accepted), an upgrade, and a revocation — driven against
`/api/projects/:id/members`.
