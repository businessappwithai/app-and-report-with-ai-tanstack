# Enterprise Reporting and Dashboard System

A production-ready enterprise reporting system built with **TanStack Start**, the **Bun** runtime, **PostgreSQL**, **Trigger.dev**, and **shadcn/ui**. Provides real-time data visualization, SQL querying, natural-language querying, role-based access control, job scheduling, and multi-format export.

## 🚀 Key Features

### Core Reporting Engine
- **TanStack Table** — headless data grid with server-side pagination, sorting, and filtering
- **Kysely** — type-safe SQL query builder for dynamic, secure data access
- **Multi-database data sources** — PostgreSQL, MySQL/MariaDB, and SQL Server connections managed per data source
- **Advanced filtering** — dynamic query builder with multiple operators
- **SQL validation** — AST-level parsing to block unsafe statements and enforce entity permissions

### Data Visualization
- **Recharts** and optional **ECharts** — bar, line, pie, area, and composed charts
- **Interactive dashboards** — drag-and-drop builder with React Grid Layout
- **DuckDB WASM** — optional in-browser SQL over result sets for instant re-slicing
- **Public share links** — read-only chart, dashboard, and report links

### Export & Delivery
- **CSV export** — fast, formatted CSV generation
- **Excel export** — spreadsheets via ExcelJS
- **PDF export** — documents via jsPDF + jspdf-autotable
- **Email delivery** — SMTP-based report distribution (Nodemailer)
- **Job queue** — Trigger.dev tasks for report generation, exports, email batches, and scheduled refreshes
- **Scheduled reports** — cron-based automated generation and delivery

### Enterprise Features
- **Two-layer RBAC** — system permissions plus per-data-source table/column entity permissions
- **Audit logging** — complete audit trail for queries, exports, and delivery
- **User management** — admin panel for users, roles, and permissions
- **Metadata management** — entity and field definitions synced from live schemas
- **Natural language queries** — Mastra + llama.cpp NL→SQL with pgvector RAG and an Apache AGE knowledge graph
- **Voice queries** — optional speech-to-text and text-to-speech endpoints
- **Session management** — custom JWT auth over HttpOnly cookies

## 📋 Technology Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Bun >= 1.3.0 |
| **Framework** | TanStack Start 1.167+ (full-stack React 19) |
| **Language** | TypeScript (strict mode) |
| **UI Library** | shadcn/ui (Radix UI + Tailwind CSS 3) |
| **State Management** | TanStack Query + TanStack Table + TanStack Form + TanStack DB |
| **Config Database** | PostgreSQL (via `pg` + Kysely) |
| **Knowledge Graph** | PostgreSQL + Apache AGE (`ers_knowledge`) |
| **Data Sources** | PostgreSQL, MySQL/MariaDB, SQL Server (via Kysely dialects) |
| **Authentication** | Custom JWT (jose) + HTTP-only cookies, bcrypt hashing |
| **Charts** | Recharts, optional ECharts |
| **Client-side SQL** | DuckDB WASM (feature-flagged) |
| **Job Queue** | Trigger.dev, with a built-in Bun cron runner as fallback |
| **AI / NL Query** | Mastra + llama.cpp (OpenAI-compatible) + CopilotKit, pgvector RAG |
| **Export Formats** | ExcelJS, jsPDF |
| **Email** | Nodemailer (SMTP) |
| **Lint / Format** | Biome |
| **Testing** | Playwright (E2E) |
| **Deployment** | Docker (Bun), Nginx reverse proxy |

## 🛠️ Installation

### Prerequisites
- **Bun** >= 1.3.0
- **PostgreSQL** (config database; the knowledge graph needs the Apache AGE extension)
- **SMTP server** — optional, for email delivery
- **Trigger.dev server** — optional; without `TRIGGER_API_URL` the app runs its built-in cron runner

### Setup Steps

1. **Clone and install**
```bash
git clone <repository>
cd enterprise_reporting_tanstack
bun install
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env — at minimum set AUTH_SECRET, ENCRYPTION_KEY, DATABASE_URL, GRAPH_DATABASE_URL
```

3. **Set up the database**
```bash
bun run db:migrate   # rebuild the PostgreSQL schema
bun run db:seed      # seed sample data + Sakila data source
```

The schema also bootstraps itself on first boot (`CREATE TABLE IF NOT EXISTS`), so a fresh database works without running these.

4. **Start services**
```bash
# Terminal 1: development server (port 4050)
bun run dev

# Terminal 2: background jobs worker
bun run jobs:worker
```

5. **Access the application**
- Application: `http://localhost:4050`
- Default credentials: `admin@admin.com` / `admin` (also `nlquery@nlquery.com` / `nlquery`)

## 📁 Project Structure

See [../CLAUDE.md](../CLAUDE.md) for detailed architecture and conventions.

Key directories:
- `src/routes/` — file-based routes: `_authed/` pages, `api/` handlers, `share/` public links
- `src/server-fns/` — TanStack Start server functions (`.inputValidator()`, not `.validator()`)
- `src/components/` — React components (UI, features, layouts)
- `src/lib/` — core libraries (db, auth, permissions, jobs, mastra, graph, duckdb, export, security)
- `src/lib/db/` — Kysely schema, bootstrap, connection manager, migrations, seeds
- `language/`, `llmtext/` — the EML modeling language and its code generator
- `e2e/` — Playwright E2E test suite
- `docs/` — supplementary documentation

## 🔒 Security Features

### SQL Injection Prevention
- Parameterized queries via Kysely
- SQL parsed to an AST and validated before execution
- Column and table access checked against data-source entity permissions
- Operator and identifier whitelisting in the filter builder

### Authentication & Authorization
- Custom JWT auth (jose) with an HttpOnly `session_token` cookie
- bcrypt password hashing
- Two-layer RBAC: system permissions (`resource:action`) plus per-data-source entity permissions
- Route-level guarding through the `_authed` layout

### Data Protection
- AES-256-GCM encryption for data source credentials
- Audit logging for sensitive operations
- Application-level row filtering by role

## 📊 Database Schema

**Config database (PostgreSQL)** holds all application configuration; reporting data stays in the external data sources.

### Core Tables
- `users`, `roles`, `user_roles` — accounts and system roles
- `resource_permissions` — resource-level access control
- `data_sources` — external database connections (encrypted config)
- `audit_log`, `logs` — audit trail and application logs

### Data Management Tables
- `report_definitions`, `chart_definitions` — report and chart configuration
- `dashboard_layouts`, `dashboard_widgets` — dashboard composition
- `saved_queries` — SQL query templates
- `filter_definitions`, `report_filters`, `chart_filters` — reusable filters
- `email_templates` — email template definitions

### Access Control Tables
- `ds_roles`, `ds_user_roles`, `ds_entity_permissions` — per-data-source RBAC

### AI / NL Query Tables
- `nl_query_context`, `nl_query_role_stats`, `nl_query_feedback` — NL query history and tuning
- `schema_table_instructions`, `schema_field_instructions` — schema hints for the NL→SQL model

### Job Management Tables
- `job_definitions`, `job_executions` — job configuration and execution history

## 🔄 Job Queue Architecture

**Trigger.dev** handles asynchronous job processing. (An earlier revision used BullMQ + Redis; that code remains under `src/lib/queue/` but is unused and its dependencies are not installed.)

### Tasks
- `report:generate` — generate scheduled or on-demand reports
- `data:export` — generate data exports (CSV, Excel, PDF)
- `email:batch` — send batch emails
- `scheduled:refresh` — refresh reports, charts, and dashboards
- monitoring evaluation — evaluate monitoring rules and raise notifications

Task definitions live in `src/lib/jobs/trigger-tasks.ts`; the work itself is in `src/lib/jobs/workers/`. Configuration is in `trigger.config.ts`.

### Backends
- **Trigger.dev** — used when `TRIGGER_API_URL` is set; the platform manages scheduling, retries, and concurrency
- **Built-in cron runner** — automatic fallback when `TRIGGER_API_URL` is unset; a pure-Bun interval loop polls `monitoring_rules` every minute and executes due rules in-process

## 📧 Email Configuration

Supports any SMTP provider (Gmail, SendGrid, AWS SES, etc.):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-app-password
```

## 🤖 Natural Language Queries

The NL pipeline runs entirely against OpenAI-compatible endpoints, so it works with local llama.cpp servers or hosted providers:

```env
MASTRA_URL=http://localhost:4111        # Mastra agent server
LLAMA_REASONING_URL=http://localhost:8080  # NL→SQL model
LLAMA_EMBEDDING_URL=http://localhost:8080  # embeddings (384 dimensions)
```

Flow: CopilotKit sidebar → `/api/copilotkit` → Mastra → LLM → SQL AST validation → RBAC check → execution. Retrieval context comes from pgvector tables plus the Apache AGE knowledge graph (`bun scripts/sync-knowledge-graph.ts`).

## 🔧 Common Commands

### Development
```bash
bun run dev              # dev server on port 4050
bun run build            # production build
bun run start            # serve the production build
```

### Quality Checks
```bash
bun run lint             # Biome lint
bun run lint:fix         # Biome lint with auto-fix
bun run typecheck        # TypeScript type checking
bun run format           # Biome format
bun run precommit        # lint + typecheck + format:check
bun run build:check      # lint + typecheck + build
```

### Database
```bash
bun run db:migrate       # rebuild schema
bun run db:seed          # seed initial data
bun run db:setup         # rebuild + seed
bun run db:sample        # seed sample data
```

### Testing
```bash
bun run test:setup       # set up test data
bun run test:e2e         # run E2E tests
bun run test:e2e:ui      # run with the Playwright UI
bun run test:e2e:headed  # run in a visible browser
bun run test:e2e:all     # test:setup + test:e2e
```

### Background Services
```bash
bun run jobs:worker      # start the jobs worker
```

## 🚦 Performance Notes

- **Server-side pagination** — all data queries apply `LIMIT`/`OFFSET` at the database level; never fetch a full table and paginate on the client
- **Connection pooling** — external data source connections are pooled per data source and health-checked before reuse
- **Caching** — TanStack Query caching and stale-while-revalidate
- **Virtual scrolling** — optional for large result sets, backed by server-side fetching
- **DuckDB WASM** — optional client-side re-querying of already-fetched result sets

## 📈 Testing

Playwright E2E suite in `e2e/`:

```bash
bun run test:e2e                                # all tests
playwright test e2e/sql-editor.spec.ts          # one spec file
playwright test e2e/sql-editor.spec.ts -g "..." # one test by name
```

The dev server must already be running on port 4050 — the `webServer` block in `playwright.config.ts` is commented out. Authentication state is created once by `e2e/global-setup.ts` and cached in `auth.json`; tests run serially with a single worker to avoid session interference. Set `BASE_URL` to target another environment.

See [TESTING.md](TESTING.md) and [../e2e/SETUP.md](../e2e/SETUP.md).

## 📚 Documentation

- **[../CLAUDE.md](../CLAUDE.md)** — architecture and conventions (authoritative)
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — technical architecture and design decisions
- **[TESTING.md](TESTING.md)** — testing guide and test organization
- **[../e2e/SETUP.md](../e2e/SETUP.md)** — E2E test setup and troubleshooting
- **[DEPLOY.md](DEPLOY.md)** — production deployment guide
- **[FEATURES.md](FEATURES.md)** — feature descriptions and capabilities

⚠️ Several files in this directory predate the migrations to PostgreSQL and Trigger.dev and still describe SQLite/MariaDB, BullMQ, Redis, and Bull Board. This README and the root `CLAUDE.md` are current; verify anything else against source before relying on it.

## 🐳 Docker Deployment

```bash
docker build -t enterprise-reporting .
docker compose up -d
```

Use the root `docker-compose.yml` — it runs PostgreSQL with Apache AGE (`apache/age:PG16`) and passes `DATABASE_URL`/`GRAPH_DATABASE_URL`. The `docker-compose.dev.yml`, `docker-compose.local.yml`, and `docker-compose.remote.yml` variants are stale: they still start a MariaDB container and pass `MARIADB_*` variables that the application ignores.

Compose services cover the app, PostgreSQL, Nginx reverse proxy, and the optional AI/NL query and speech services (`Dockerfile.mastra`, `Dockerfile.nlquery`, `Dockerfile.stt`).

Key deployment variables:
- `AUTH_SECRET` — JWT signing key (min 32 chars)
- `ENCRYPTION_KEY` — AES-256-GCM key (64 hex chars) for data source credentials
- `DATABASE_URL` — PostgreSQL config database
- `GRAPH_DATABASE_URL` — Apache AGE knowledge graph database
- `TRIGGER_API_URL` — Trigger.dev server (omit to use the built-in cron runner)
- `MASTRA_URL`, `LLAMA_REASONING_URL`, `LLAMA_EMBEDDING_URL` — AI services
- `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE` — server-side pagination limits

See [DEPLOY.md](DEPLOY.md) for the complete deployment guide.

## 🤝 Contributing

1. Read [../CLAUDE.md](../CLAUDE.md) for project conventions
2. Run `bun run precommit` before committing
3. Ensure E2E tests pass with `bun run test:e2e`
4. Follow existing patterns and TypeScript strict mode

## 🆘 Troubleshooting

**Tests fail with an authentication error**
```bash
rm -f auth.json
bun run db:setup
```

**Port 4050 already in use**
```bash
lsof -ti:4050 | xargs kill -9
```

**Server functions crash at runtime** — check that they use `.inputValidator()`, not `.validator()`; the Vite plugin passes unknown method names through to the client bundle verbatim.

**Data source connection fails over IPv6** — the connection manager resolves hostnames to IPv4 explicitly for this reason; verify `ssl.servername` is preserved if you change that path.

## 📄 License

Copyright © 2024-2026 Enterprise Reporting System. All rights reserved.
