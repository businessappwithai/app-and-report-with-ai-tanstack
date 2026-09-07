# EML CLI (`eml`)

A zero-runtime-dependency TypeScript CLI that reads the
[Enterprise Reporting Modeling Language](../README.md) definition, parses an
`.mmd` EML model (ERD + business rules + workflows), validates it with
self-correction, and generates a complete, runnable application from it.

Runs under **Bun** (source). No project install required.

```bash
bun language/cli/eml.ts --help
```

## Commands

| Command | Purpose |
|---------|---------|
| `generate` | Parse → validate (self-correct) → generate app |
| `validate` | Parse and validate a model; report diagnostics; exit 1 on errors |
| `info` | Print a summary of the parsed model |
| `help` | Show usage |

## Options

```
-i, --input <file>        Input .mmd EML file (or first positional arg)
-o, --output <dir>        Output directory for the generated app
-n, --name <name>         Application name (default: derived from the model)
    --stack <stack>       enterprise-reporting (default) | node-rest
    --docker              Also emit Dockerfile + docker-compose.yml (node-rest only)
    --github <owner/repo> Publish the generated app to a GitHub repository
    --github-token <tok>  GitHub token (else GITHUB_TOKEN / GH_TOKEN)
    --private | --public  Visibility of the created GitHub repo (default private)
    --no-autofix          Disable validation self-correction
    --force               Overwrite a non-empty output directory
    --json                Machine-readable output (validate/info)
-h, --help                Show help
-v, --version             Show version
```

## Examples

```bash
# Validate a model (with self-correction preview)
bun language/cli/eml.ts validate -i language/examples/helpdesk.eml.mmd

# Summarize the parsed model
bun language/cli/eml.ts info -i language/examples/helpdesk.eml.mmd

# Generate TanStack Start + Kysely code (enterprise-reporting, the default)
bun language/cli/eml.ts generate -i model.mmd -o ./out

# Explicitly specify the stack
bun language/cli/eml.ts generate -i model.mmd -o ./out --stack enterprise-reporting

# Generate a prototype Node REST app
bun language/cli/eml.ts generate -i model.mmd -o ./out --stack node-rest --docker

# Generate and publish to GitHub (needs GITHUB_TOKEN)
bun language/cli/eml.ts generate -i model.mmd -o ./out --github me/my-app --public
```

## Stacks

### `enterprise-reporting` (default)

Generates **TanStack Start + Kysely + MariaDB** code that slots directly into
this repository. For each entity the generator produces:

- `src/server-fns/<entity>.ts` — five CRUD server functions, each using
  `.inputValidator()` (never `.validator()`), `requireAuth()`, and Kysely
  via `getDb()`. Includes a Zod schema and TypeScript type.
- `src/routes/_authed/<entity>/index.tsx` — paginated list page with TanStack
  Table and shadcn/ui components.
- `src/routes/_authed/<entity>/$id.tsx` — detail / edit page with an inline
  form and delete button.

Shared outputs:

- `src/lib/db/migrations/<ts>_create_tables.ts` — Kysely migration with
  MariaDB DDL (`CREATE TABLE IF NOT EXISTS`, `DATETIME`, `UUID()` default).
- `KYSELY_TYPES.md` — a ready-to-paste snippet for the `Database` interface
  in `src/lib/db/kysely-db.ts`.

Generated output structure:

```
out/
├── src/
│   ├── server-fns/<entity>.ts
│   ├── routes/_authed/<entity>/
│   │   ├── index.tsx
│   │   └── $id.tsx
│   └── lib/db/migrations/<ts>_create_tables.ts
├── KYSELY_TYPES.md
└── README.md
```

### `node-rest`

A self-contained, **dependency-free** Node app (`node:http` + JSON-file
datastore). Useful for prototyping without the full reporting stack. With
`--docker` it also emits a `Dockerfile`, `docker-compose.yml`, and a GitHub
Actions workflow at `.github/workflows/app-ci.yml`.

## Business rules → GoRules JDM

For either stack, each EML business rule section is converted to a GoRules JDM
decision document and written to `<out>/rules/`. Node shapes map to JDM roles
(stadium→input/output, diamond→switch, circle→function, rect→expression).

## Architecture

```
.mmd EML ──parser.ts──▶ EmlModel ──validator.ts──▶ (self-corrected) ──generate/*──▶ app
                ▲
    language/erdwithai-language.json  (types, cardinalities, directives, …)
```

## Validation & self-correction

`validate` and `generate` share the same validator. With self-correction on
(default), fixable problems are repaired in place and reported as `fix`
diagnostics; without it (`--no-autofix`) they are reported as errors/warnings.

| Code | Problem | Auto-fix |
|------|---------|----------|
| `EML001` | No document name | derive a name |
| `EML101` | Duplicate entity | merge attributes |
| `EML102` | Duplicate attribute | drop the duplicate |
| `EML103` | Entity has no primary key | add `string id PK` |
| `EML120` | Relationship endpoint not an entity | synthesize a minimal entity |
| `EML130` | Field references unknown enum | warn (treated as free string) |
| `EML202` | Unknown hook type | error (not auto-fixable) |
| `EML210` | Hook bound to unknown entity | synthesize a minimal entity |
| `EML300` | Rule missing input/output node | warn |
| `EML400` | State workflow has no transitions | warn |

## Development

```bash
cd language/cli
bun install          # dev-only: TypeScript + type packages
bun run typecheck    # tsc --noEmit
bun run lint         # biome check
```
