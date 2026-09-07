# QA Report — Application-wide Tremor rollout + CRM reporting end-to-end

**Branch:** `claude/tremor-design-system-n4g6o9` (restarted from `main` after PR #1 merged)
**Scope:** Tremor design applied to every screen; a CRM database built, connected as a
data source, and exercised through SQL, report definitions and chart definitions.
**Method:** gstack `/qa` methodology, run against a live server with a real admin
session in Chromium. Screenshots: `pics/` (51 files).

## Test fixture

A PostgreSQL CRM database (`crm_demo`) with 12 related entities, **200 records each**
(order lines are child rows, so 497):

| Entity | Rows | Entity | Rows |
|--------|------|--------|------|
| accounts | 200 | opportunities | 200 |
| contacts | 200 | orders | 200 |
| leads | 200 | order_items | 497 |
| campaigns | 200 | invoices | 200 |
| products | 200 | activities | 200 |
| sales_reps | 200 | support_tickets | 200 |

Referential integrity is real (foreign keys, owner reps, campaign attribution), and
values are internally consistent — stage drives probability, `is_won` drives closed
state, resolved tickets carry resolution timestamps. Schema and generator are checked
in at `fixtures/crm-demo/`.

The database was registered **through the application UI** (Data Sources → New Data
Source → PostgreSQL → Test Connection → Create), not by direct insert, so the
encrypted-connection path was exercised too. Result: "Connected".

## What was tested

### SQL execution — 10/10 passed

Ten analytical queries were created as saved queries and executed against the CRM
source through `/api/sql/execute`. All returned correct shapes; total execution time
for the ten was **217 ms**.

| Query | Rows | Cols | Exercises |
|-------|------|------|-----------|
| Pipeline by Stage | 6 | 5 | GROUP BY, weighted arithmetic |
| Monthly Bookings Trend | 25 | 4 | `DATE_TRUNC`, `TO_CHAR`, filtered aggregate |
| Revenue by Industry | 10 | 4 | JOIN + `COUNT(DISTINCT)` |
| Top 20 Accounts by Value | 20 | 7 | multi-JOIN, LEFT JOIN, LIMIT |
| Sales Rep Leaderboard | 25 | 7 | **CTE**, `NULLIF` guard, quota maths |
| Lead Funnel by Source | 6 | 6 | `FILTER (WHERE …)` aggregates |
| Product Category Margin | 5 | 6 | derived margin, `NULLIF` |
| Support SLA by Priority | 4 | 5 | `EXTRACT(EPOCH …)` interval maths |
| Campaign ROI | 23 | 7 | `HAVING`, filtered aggregates |
| Invoice Aging | 2 | 3 | `CASE` bucketing on `CURRENT_DATE` |

### Report definitions — 10/10 render

Each query was published as a report definition and opened in the viewer. All ten
render their table with the expected column and row counts (Pipeline 6×5, Bookings
25×4, Leaderboard 25×7, Top Accounts 20×7, Campaign ROI 23×7, …), with sorting,
column chooser, search and pagination present.

### Chart definitions — 8/8 render

Eight charts (bar, line, pie, multi-series bar) were created against the same queries
and each renders a canvas through the Tremor-themed ECharts adapter, in the Tremor
categorical palette.

## Findings

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | High | Report viewer showed "1 to 6 of 6 results" with **no table** | Fixed (data + code) |
| 2 | Medium | `/logs` reported 256px horizontal overflow | Not a defect |
| 3 | Low | `/admin/roles` intermittently bounced to the login page | Not reproducible |
| 4 | Info | `/monitoring`, `/nl-query` 500; `/email-templates`, `/datasets` 404 | Environment |

**1 — Report renders no table (high, functional).** A report created with an empty
`columnConfig` fetches and counts its rows but renders zero columns, so the viewer
shows the search bar, the "Showing 1 to N of N results" line and the pager around an
invisible table. The cause is in the viewer: it derives columns *only* from
`column_config`, with no fallback to the result set's own columns. Reproduced by
creating a report via `POST /api/reports` with `columnConfig: []`, which the endpoint
accepts. Fixed here by deriving column definitions from each query's actual result
columns and `PUT`ing them back — all ten reports then rendered.

The underlying fragility was then fixed in code: the viewer now falls back to the
result set's own columns (title-cased) whenever `column_config` is missing, empty, all
hidden or unparseable, so a report can never render as an empty frame again. Verified
by creating a report with `columnConfig: []` after the fix — it renders 5 columns and
6 rows with headers derived from the query (`pics/70-report-empty-config-fallback.png`).

**2 — `/logs` horizontal overflow (medium → not a defect).** Traced to the CopilotKit
floating widget's SVG (right edge 1449px against a 1440px viewport), a third-party
overlay, not application layout. No application element exceeded the viewport.

**3 — `/admin/roles` bounced to login (low → not reproducible).** Seen once during the
sweep alongside a `Failed to fetch` from `use-active-datasource` while the dev server
was recompiling. Not reproducible in three subsequent runs; the audit pass records it
as PASS.

**4 — Environment, not code.** `/monitoring` and `/nl-query` return 500 and
`/email-templates`/`/datasets` return 404 because this environment runs the config
database on PostgreSQL, where the app's MySQL-only schema bootstrap could not create
every table (documented in the previous QA report). Both pages still render their
Tremor chrome correctly around the failed fetch.

## Design conformance audit

Every route was probed against the Tremor preset values from
[tremorlabs/tremor-npm](https://github.com/tremorlabs/tremor-npm) — computed styles,
not class names:

| Check | Expected | Result |
|-------|----------|--------|
| App canvas | `rgb(249,250,251)` gray-50 | 28/28 pass |
| Page title | 24px, weight ≤ 600, gray-900 | 28/28 pass |
| Card radius | 8px (`rounded-tremor-default`) | 41 cards, all pass |
| Button radius | ≤ 12px — no pills | 161 buttons, all pass |
| Input radius | 8px / 6px | all pass |
| Table header | gray-900, weight ≥ 600 | all pass |
| Legacy Swiss blue `#0000FF` | absent | 0 occurrences |

**28 routes audited, 0 violations.** Routes covered: dashboard, sql-editor, queries,
reports, charts, dashboards, filters, jobs, monitoring, nl-query, report generator,
data-sources, queue management, logs, users, roles, permissions, settings (email/ui/
design-system), metadata entities, monitoring create, plus three report viewers and
three chart viewers.

## Verification

- `bun run build` passes; `bun run typecheck` reports no new errors (582, unchanged
  from base).
- 51 screenshots in `pics/`, covering the data-source flow, all 10 reports, all 8
  charts, and all 24 application screens.
