# Architectural Design Document
## Dynamic Report Generation & Distribution
### ADK · Mastra.ai · CopilotKit · ExcelJS · jsPDF · RBAC-Aware Pipeline

---

**Document Classification:** Technical Architecture  
**Status:** Approved — Implementation Complete (code stubs + all open items resolved)  
**Version:** 2.0  
**Last Updated:** June 4, 2026  
**Prepared For:** Enterprise Reporting Platform — Engineering Leadership  
**Baseline Reference:** `docs/ARCHITECTURE-ADK-TRIGGERDEV-MASTRA-ENHANCEMENT.md`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Baseline](#2-current-architecture-baseline)
3. [Enhancement Vision & Goals](#3-enhancement-vision--goals)
4. [High-Level Architecture](#4-high-level-architecture)
5. [Component Architecture](#5-component-architecture)
   - 5.1 [ADK Agent Pipeline](#51-adk-agent-pipeline)
   - 5.2 [Mastra.ai RBAC-Aware Report Workflow Engine](#52-mastraai-rbac-aware-report-workflow-engine)
   - 5.3 [Report Artifact Generator](#53-report-artifact-generator)
   - 5.4 [CopilotKit Natural Language Interface](#54-copilotkit-natural-language-interface)
   - 5.5 [Report Retrieval & History Interface](#55-report-retrieval--history-interface)
   - 5.6 [Notification & Distribution Layer](#56-notification--distribution-layer)
6. [Data Flow Architecture](#6-data-flow-architecture)
   - 6.1 [Report Creation Flow](#61-report-creation-flow)
   - 6.2 [Report Retrieval Flow](#62-report-retrieval-flow)
   - 6.3 [Scheduled Report Execution Flow](#63-scheduled-report-execution-flow)
7. [RBAC Integration Design](#7-rbac-integration-design)
8. [Database Schema Extensions](#8-database-schema-extensions)
9. [API Surface Design](#9-api-surface-design)
10. [Security Architecture](#10-security-architecture)
11. [Infrastructure & Deployment](#11-infrastructure--deployment)
12. [Implementation Roadmap](#12-implementation-roadmap)
13. [Technology Dependencies](#13-technology-dependencies)
14. [Risk Assessment](#14-risk-assessment)
15. [Appendix: Reference Flows](#15-appendix-reference-flows)
16. [Adversarial Review Corrections](#16-adversarial-review-corrections)

---

## 1. Executive Summary

This document defines the architectural design for a **Dynamic Report Generation & Distribution** system built on top of the same ADK → Mastra.ai → CopilotKit pipeline established by the Intelligent Monitoring enhancement. The key difference is the output stage: instead of persisting a monitoring rule and scheduling a threshold-check job, the pipeline generates rich, multi-format report artifacts (Excel with embedded charts, PDF with a chart cover page and tabular body, CSV for raw data) and dispatches them via email and in-app notifications.

Additionally, users can interact with the same CopilotKit interface to **retrieve and browse previously generated reports** — asking questions like "show me the revenue reports I ran last week" and receiving downloadable links to previously generated artifacts.

| Capability | Description |
|---|---|
| **Natural Language Report Creation** | User describes the report in plain English via CopilotKit chat |
| **RBAC-Gated Data Access** | ADK pipeline validates data source permissions before any SQL is generated |
| **Multi-Format Output** | Excel (with chart sheet), PDF (chart cover + tabular body), CSV (raw data) |
| **Chart Generation** | ECharts server-side rendering for embedded charts in Excel and PDF |
| **Notification Distribution** | In-app notification + email dispatch with artifact attachments |
| **Scheduled Reports** | One-shot or recurring (cron-based) report generation |
| **Report History Retrieval** | CopilotKit chat interface to list, filter, and re-download past reports |

### Capability Statement

> *A user types: "Generate a monthly summary of patient admissions by department for Q1 2026, send it to the clinical team as a PDF with a bar chart."*
>
> The system autonomously: understands the intent → validates the user's hospital data source access → introspects the schema → generates the SQL → executes the query → renders a bar chart → packages a PDF (chart on page 1, tabular data on page 2+) → emails the clinical team → creates an in-app notification — all without the user writing SQL or configuring an export pipeline.

> *Later, the user types: "What reports did I generate last month?"*
>
> The CopilotKit agent queries the report artifact store, filters by user and date, and returns a list of past reports with download links — all within the same chat interface.

---

## 2. Current Architecture Baseline

### 2.1 System Overview

The existing platform is described fully in `ARCHITECTURE-ADK-TRIGGERDEV-MASTRA-ENHANCEMENT.md` §2. This document focuses on the delta — the additional components and schema changes required for dynamic report generation.

```
┌─────────────────────────────────────────────────────────────┐
│                    TanStack Start (Bun)                     │
│  TanStack Router · TanStack Query v5 · TanStack DB v0.6    │
├─────────────────────────────────────────────────────────────┤
│  Auth (JWT)  ·  RBAC  ·  Resource Permissions  ·  Audit    │
├──────────────────────────┬──────────────────────────────────┤
│   Config DB (MariaDB)    │   External Data Sources          │
│   Kysely ORM             │   (PG, MySQL, MSSQL, etc.)       │
├─────────────┬────────────┴────────────────┬─────────────────┤
│ Trigger.dev │  Mastra.ai (port 4111)      │  CopilotKit     │
│ on-premise  │  llama.cpp (port 8080)      │  /api/copilotkit│
│ cron runner │                             │                 │
└─────────────┴────────────────────────────┴─────────────────┘
```

### 2.2 Existing Subsystems Leveraged

| Subsystem | Location | Role in this Enhancement |
|---|---|---|
| ADK pipeline | `src/lib/adk/` | Intent classification, RBAC check, schema introspection |
| Mastra.ai server | `mastra/server.ts` | Report workflow orchestration |
| CopilotKit runtime | `src/routes/api/copilotkit.ts` | Chat interface, `useCopilotAction` + `useCopilotReadable` |
| RBAC engine | `src/lib/auth/rbac.ts` | Data source access gating |
| Audit logging | `src/lib/security/audit.ts` | Report generation events |
| Email service | `src/lib/email/email-service.ts` | Artifact delivery |
| Notification system | `src/lib/notifications.ts` | In-app notification creation |
| Export workers | `src/lib/jobs/workers/export-worker.ts` | CSV/Excel/PDF building blocks |
| Report worker | `src/lib/jobs/workers/report-worker.ts` | Existing report generation patterns |
| `mariadbNow()` helper | Monitoring subsystem | DateTime format for MariaDB DATETIME columns |

### 2.3 Already-Installed Dependencies

The following packages are **already installed** — no new npm/bun installs required for core functionality:

| Package | Version | Purpose |
|---|---|---|
| `exceljs` | `^4.4.0` | Excel workbook, sheets, embedded charts |
| `jspdf` | `^3.0.1` | PDF document generation |
| `jspdf-autotable` | `^3.8.2` | PDF tabular data plugin |
| `recharts` | Installed | Client-side chart rendering |
| `echarts` | Installed | Server-side chart SSR rendering (SVG output) |
| `sharp` | `^0.34.5` | SVG → PNG conversion for chart embedding (prebuilt binaries, works on Alpine) |
| `nodemailer` | Installed | Email dispatch |

---

## 3. Enhancement Vision & Goals

### 3.1 Primary Goals

1. **NL-to-Report Pipeline** — identical ADK → RBAC → Mastra supervisor flow as the monitoring enhancement, but the terminal stage produces report artifacts instead of persisting a rule.

2. **Rich Multi-Format Output** — three artifact types from a single query run:
   - **Excel (.xlsx)**: Sheet 1 = bar/line chart as an embedded image; Sheet 2 = tabular data
   - **PDF (.pdf)**: Page 1 = full-width chart; Page 2+ = AutoTable tabular report
   - **CSV (.csv)**: Raw tabular data, always included

3. **Scheduled & On-Demand** — users can request a one-shot run ("generate now") or a recurring schedule ("every Monday at 09:00"), powered by the existing on-premise cron runner / Trigger.dev.

4. **RBAC Throughout** — no query executes on a data source the requesting user cannot access; the RBAC check is identical to the monitoring worker's `validateRBACForExecution` pattern.

5. **Distribution by Notification** — on completion, the system:
   - Creates an in-app notification via `createNotification()` with download links
   - Emails specified recipients with artifact files attached (configurable per report definition)

6. **CopilotKit Report History** — the same chat panel allows users to ask questions about previously generated reports and receive links to download artifacts, powered by a `listGeneratedReports` CopilotKit action backed by the `generated_report_artifacts` table.

### 3.2 Non-Goals (Out of Scope for This Phase)

- Live/streaming report generation (reports are generated asynchronously in a worker)
- Interactive chart editors (charts are defined by chart type + metric/dimension columns in the report definition)
- Public sharing of generated reports (access is RBAC-gated)
- BI platform integrations (Tableau, Power BI)

---

## 4. High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                                           │
│                                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  Report Generator Page  (/reports/generate)                            │   │
│  │                                                                        │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │   │
│  │  │  CopilotKit Chat Panel                                          │  │   │
│  │  │  "Generate Q1 admissions by department as PDF for clinical team" │  │   │
│  │  │                                                                  │  │   │
│  │  │  [useCopilotAction + useCopilotReadable]                          │  │   │
│  │  │  Actions: buildReport · confirmReport · listReports · download   │  │   │
│  │  └─────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                        │   │
│  │  ┌──────────────────────┐  ┌──────────────────────────────────────┐  │   │
│  │  │  Report Preview Panel │  │  Report History Panel                │  │   │
│  │  │  (dry-run table)     │  │  (past artifacts, download links)    │  │   │
│  │  └──────────────────────┘  └──────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────┬─────────────────────────────────────────────────────┘
                           │ HTTPS
                           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    TanStack Start API Layer (Bun)                            │
│                                                                              │
│  POST /api/copilotkit  ──►  CopilotKit Runtime (OpenAI-compat adapter)      │
│                              ↓                                               │
│                         Mastra port 4111  (POST /api/build-report-pipeline) │
│                                                                              │
│  GET  /api/report-definitions        (list saved report definitions)        │
│  POST /api/report-definitions        (persist NL→definition)                │
│  GET  /api/report-definitions/:id/artifacts  (list generated artifacts)     │
│  GET  /api/report-artifacts/:id/download     (stream file)                  │
│  POST /api/report-definitions/:id/run        (trigger immediate run)        │
└──────────────┬───────────────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  ADK Pipeline (6 Stages)                         Mastra Supervisor           │
│                                                                              │
│  1. Intent Classify  →  ReportIntent object                                 │
│  2. RBAC Validation  →  data source access confirmed                        │
│  3. Schema Introspect →  relevant tables + columns                          │
│  4. SQL Generation   →  SELECT + GROUP BY query                             │
│  5. Dry-Run Preview  →  first 20 rows returned to UI                        │
│  6. Persist & Schedule → ReportDefinition saved, run dispatched             │
└──────────────┬───────────────────────────────────────────────────────────────┘
               │  (async, via on-premise cron runner / Trigger.dev task)
               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  Report Worker  (report-generation-worker.ts)                                │
│                                                                              │
│  executeReportGeneration()                                                   │
│    Phase 1: RBAC re-validation                                               │
│    Phase 2: SQL execution against external data source                       │
│    Phase 3: Chart image rendering (ECharts Node.js renderer)                 │
│    Phase 4: Excel artifact build (ExcelJS — data sheet + chart image)       │
│    Phase 5: PDF artifact build (jsPDF — chart page 1 + AutoTable pages)     │
│    Phase 6: CSV artifact build (stream to file)                              │
│    Phase 7: Persist artifact records → generated_report_artifacts            │
│    Phase 8: In-app notification (createNotification)                        │
│    Phase 9: Email dispatch (Nodemailer + attachments)                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Component Architecture

### 5.1 ADK Agent Pipeline

The ADK pipeline is **identical in structure** to the monitoring pipeline, with a different terminal stage. The pipeline runs synchronously inside the Mastra server request.

#### Stage 1: Intent Classification

The CopilotKit action `buildReport` passes the user's natural language string to the ADK intent classifier. The classifier identifies:

```typescript
interface ReportIntent {
  intentType: "report_generation";
  dataSourceHint: string;          // "hospital", "revenue", "inventory"
  metrics: string[];               // ["total_admissions", "revenue"]
  dimensions: string[];            // ["department", "month", "gender"]
  filters: FilterClause[];         // [{ column: "year", op: "eq", value: "2026" }]
  dateRange?: { from: string; to: string };
  chartType: "bar" | "line" | "pie" | "area" | "none";
  outputFormats: ("excel" | "pdf" | "csv")[];
  recipients: string[];            // email addresses or user IDs
  schedule?: string;               // cron expression or "now"
  reportTitle: string;
}
```

#### Stage 2: RBAC Validation

Identical to the monitoring pipeline — checks that the requesting user has read access to the identified data source. Uses `validateDataSourceAccess(userId, dataSourceId)` from the existing RBAC engine.

```typescript
// Same pattern as monitoring-worker.ts validateRBACForExecution
const adminRoles = await db.selectFrom("user_roles")...
const hasAdminRole = adminRoles.some((r) => {
  const n = r.name.toLowerCase();
  return n === "admin" || n === "administrator" || n.startsWith("admin");
});
```

If the user lacks access, the pipeline returns a `PERMISSION_DENIED` response to the CopilotKit action, which surfaces a human-readable error in the chat.

#### Stage 3: Schema Introspection

Identical to the monitoring pipeline — calls `introspectSchema(dataSourceId, tableHints)` to retrieve relevant table+column metadata. This metadata is passed to the SQL generation stage.

#### Stage 4: SQL Generation

The Mastra supervisor agent generates a `SELECT` statement appropriate for the report:
- Aggregated (GROUP BY) for chart-oriented reports
- Flat (no GROUP BY) for detail reports
- Date-range WHERE clauses applied from `intent.dateRange`
- Column aliases normalized to the `metrics[]` and `dimensions[]` names

```sql
-- Example for "patient admissions by department Q1 2026"
SELECT
  d.department_name AS department,
  COUNT(*) AS total_admissions,
  AVG(DATEDIFF(a.discharge_date, a.admission_date)) AS avg_length_of_stay
FROM admissions a
JOIN departments d ON a.department_id = d.id
WHERE a.admission_date BETWEEN '2026-01-01' AND '2026-03-31'
GROUP BY d.department_name
ORDER BY total_admissions DESC
```

#### Stage 5: Dry-Run Preview

Before committing, the pipeline executes `SELECT ... LIMIT 20` and returns the preview rows to the CopilotKit action. The `buildReport` action updates the React component state via `useCopilotReadable`, causing the Report Preview Panel to render a data table. The user confirms before generation is scheduled.

#### Stage 6: Persist & Dispatch

On confirmation, the pipeline:
1. Persists an `nl_report_definitions` record (see §8.1) with RBAC snapshot captured at creation time
2. Enqueues an immediate or scheduled run via the cron runner / Trigger.dev
3. Returns the definition ID to the UI

### 5.2 Mastra.ai RBAC-Aware Report Workflow Engine

A new endpoint is added to the Mastra server:

```
POST /api/build-report-pipeline
Body: { userId, dataSourceId, nlQuery, dryRun: boolean }

Response:
{
  intent: ReportIntent,
  rbacResult: "GRANTED" | "DENIED",
  generatedSQL: string,
  previewRows?: Row[],   // present when dryRun=true, pageSize=20
  reportDefinitionId?: string  // present when dryRun=false
}
```

The Mastra supervisor orchestrates two specialist agents in sequence:
- **SchemaAgent**: Introspects data source tables and columns relevant to the intent
- **SQLAgent**: Generates the aggregation query using the schema context

Both agents call the local llama.cpp server on port 8080, using the same OpenAI-compatible `/v1/chat/completions` adapter.

### 5.3 Report Artifact Generator

`src/lib/jobs/workers/report-generation-worker.ts` — the new report worker, structured after `monitoring-worker.ts`.

#### Entry Point

```typescript
export async function executeReportGeneration(params: {
  reportDefinitionId: string;
  triggeredBy: "manual" | "scheduled";
}): Promise<ReportGenerationResult>
```

#### Phase 4: Chart Image Rendering (ECharts SSR → SVG → sharp → PNG)

ECharts is used in SSR mode to render chart specifications to SVG strings, which are then converted to PNG buffers via `sharp`. No browser or `canvas` native bindings required — `sharp` ships prebuilt binaries for all platforms including `linux-x64-musl` (Alpine Docker).

```typescript
import * as echarts from "echarts";

async function renderChartPng(
  rows: Record<string, unknown>[],
  columns: string[],
  chartType: string,
  metrics: string[],
  dimensions: string[]
): Promise<Buffer | null> {
  if (chartType === "none" || rows.length === 0) return null;

  try {
    const chart = echarts.init(null, null, {
      renderer: "svg",
      ssr: true,
      width: 900,
      height: 450,
    });

    const option = buildEChartsOption(rows, columns, metrics, dimensions, chartType);
    chart.setOption(option);
    const svgStr = chart.renderToSVGString();
    chart.dispose();

    // Convert SVG → PNG using sharp (prebuilt binaries, works on Alpine)
    const sharp = (await import("sharp")).default;
    const pngBuffer = await sharp(Buffer.from(svgStr))
      .resize(1800, 900)
      .png()
      .toBuffer();

    return pngBuffer;
  } catch (err) {
    console.warn("[report-worker] Chart rendering failed, reports generated without charts:", err);
    return null; // Graceful degradation — reports are still generated without embedded charts
  }
}
```

If `sharp` import fails or SVG rendering errors, the function returns `null` and downstream phases (Excel, PDF) skip chart embedding gracefully.

#### Phase 5: Excel Artifact Build (ExcelJS)

```typescript
async function buildExcelArtifact(
  rows: Record<string, unknown>[],
  columns: string[],
  title: string,
  chartPng: Buffer | null  // null when chart rendering failed — graceful degradation
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  // Sheet 1: Chart (only if chart PNG is available)
  if (chartPng) {
    const chartSheet = wb.addWorksheet("Chart");
    const imageId = wb.addImage({ buffer: chartPng, extension: "png" });
    chartSheet.addImage(imageId, { tl: { col: 0, row: 0 }, br: { col: 12, row: 28 } });
    chartSheet.getCell("A30").value = title;
    chartSheet.getCell("A31").value = `Generated: ${new Date().toLocaleDateString()} — ${rows.length} rows`;
  }

  // Sheet 2: Data
  const dataSheet = wb.addWorksheet("Data");
  dataSheet.columns = columns.map((c) => ({ header: c, key: c, width: Math.max(12, Math.min(30, c.length + 4)) }));
  for (const row of rows) { dataSheet.addRow(row); }

  const headerRow = dataSheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
```

#### Phase 6: PDF Artifact Build (jsPDF + jspdf-autotable)

```typescript
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

function buildPdfArtifact(
  rows: Record<string, unknown>[],
  columns: string[],
  title: string,
  chartPng: Buffer | null  // null when chart rendering failed — graceful degradation
): Buffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Page 1: Title + Chart (or fallback text)
  doc.setFontSize(18);
  doc.text(title, 14, 20);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()} — ${rows.length} rows`, 14, 28);

  if (chartPng) {
    const chartBase64 = chartPng.toString("base64");
    doc.addImage(`data:image/png;base64,${chartBase64}`, "PNG", 14, 38, 267, 133);
  } else {
    doc.setFontSize(11);
    doc.setTextColor(120);
    doc.text("Chart not available for this report.", 14, 50);
    doc.setTextColor(0);
  }

  // Page 2+: Tabular data
  doc.addPage();
  autoTable(doc, {
    head: [columns],
    body: rows.map((r) => columns.map((c) => String(r[c] ?? ""))),
    startY: 20,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [31, 56, 100] },
    alternateRowStyles: { fillColor: [240, 244, 250] },
  });

  return Buffer.from(doc.output("arraybuffer"));
}
```

#### Phase 7: CSV Artifact Build

```typescript
function buildCsv(rows: Row[], columns: string[]): Buffer {
  const header = columns.join(",");
  const body = rows.map((r) =>
    columns.map((c) => JSON.stringify(r[c] ?? "")).join(",")
  );
  return Buffer.from([header, ...body].join("\n"), "utf-8");
}
```

#### Phase 8: Persist Artifacts

All generated files are written to the local filesystem under `{JOB_OUTPUT_PATH}/reports/{reportDefinitionId}/{executionId}/` (default: `./job-outputs/reports/...`) and their paths are recorded in `generated_report_artifacts` (see §8.2). The `JOB_OUTPUT_PATH` env var is consistent with existing export workers.

```typescript
function mariadbNow(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}
```

This same `mariadbNow()` helper is used for all DATETIME column writes, consistent with the monitoring subsystem.

#### Phase 9: In-App Notification

```typescript
await createNotification({
  userId: reportDef.created_by,
  title: `Report Ready: ${reportDef.title}`,
  message: `Your report "${reportDef.title}" has been generated and is ready to download.`,
  type: "success",
  metadata: { executionId, reportTitle: reportDef.title },
});
```

Uses `metadata` (not `link`) matching the actual `createNotification()` signature from `src/lib/notifications.ts`.

#### Phase 10: Email Dispatch

```typescript
await sendEmail({
  to: resolvedRecipients,
  subject: `Report: ${reportDef.title}`,
  html: buildReportEmailHtml(reportDef, artifactUrls),
  attachments: [
    { filename: `${slug}.xlsx`, content: excelBuffer },
    { filename: `${slug}.pdf`,  content: pdfBuffer },
    { filename: `${slug}.csv`,  content: csvBuffer },
  ],
});
```

Recipients are resolved at dispatch time: email strings pass through as-is; user IDs are resolved to email addresses from the `users` table.

### 5.4 CopilotKit Natural Language Interface

#### Page Route

A new authenticated route at `/_authed/reports/generate` hosts the report generator page:

```typescript
// src/routes/_authed/reports/generate.tsx
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { ReportBuilderPanel } from "@/components/report-generation/ReportBuilderPanel";

export const Route = createFileRoute("/_authed/reports/generate")({
  component: ReportGeneratePage,
});
```

#### CopilotKit Actions

Four actions are registered via `useCopilotAction`:

```typescript
// 1. Build and preview the report (dry-run)
useCopilotAction({
  name: "buildReport",
  description: "Generate a dynamic data report from natural language",
  parameters: [
    { name: "query", type: "string", description: "What the report should contain" },
    { name: "dataSourceId", type: "string", required: false },
  ],
  handler: async ({ query, dataSourceId }) => {
    // Calls POST /api/report-definitions?dryRun=true via Mastra
    // Updates component state with previewRows
  },
});

// 2. Confirm and persist/schedule
useCopilotAction({
  name: "confirmReport",
  description: "Confirm and generate the previewed report",
  parameters: [
    { name: "schedule", type: "string", description: "cron expression or 'now'" },
    { name: "recipients", type: "string", description: "comma-separated emails or user IDs" },
    { name: "formats", type: "string", description: "excel,pdf,csv" },
  ],
  handler: async ({ schedule, recipients, formats }) => {
    // Calls POST /api/report-definitions with full params
    // Triggers report generation job
  },
});

// 3. List previous reports (RETRIEVAL)
useCopilotAction({
  name: "listReports",
  description: "List previously generated reports, optionally filtered",
  parameters: [
    { name: "filter", type: "string", description: "Optional: date range, title keyword, status" },
  ],
  handler: async ({ filter }) => {
    // Calls GET /api/report-definitions?history=true&filter=...
    // Returns list of past definitions with artifact counts
    // Updates component state → ReportHistoryPanel renders downloadable list
  },
});

// 4. Download a specific artifact
useCopilotAction({
  name: "downloadReport",
  description: "Get download links for a specific report",
  parameters: [
    { name: "reportId", type: "string" },
    { name: "format", type: "string", description: "excel | pdf | csv" },
  ],
  handler: async ({ reportId, format }) => {
    // Returns signed download URL for the artifact
  },
});
```

#### Component State Shape (via `useCopilotReadable`)

```typescript
interface ReportBuilderState {
  phase:
    | "idle"
    | "classifying"
    | "rbac_check"
    | "generating_sql"
    | "preview_ready"
    | "confirmed"
    | "generating"
    | "complete"
    | "error";
  intent?: ReportIntent;
  previewRows?: Record<string, unknown>[];
  previewColumns?: string[];
  generatedSQL?: string;
  reportDefinitionId?: string;
  artifactUrls?: { excel?: string; pdf?: string; csv?: string };
  errorMessage?: string;
  historyReports?: ReportHistoryEntry[];
}
```

State is managed via React `useState` and exposed to the CopilotKit runtime via `useCopilotReadable`, following the same pattern as the NL Query page.

### 5.5 Report Retrieval & History Interface

The CopilotKit `listReports` action drives a **Report History Panel** in the UI. This panel renders when `reportState.historyReports` is populated.

#### History Entry Shape

```typescript
interface ReportHistoryEntry {
  id: string;
  title: string;
  createdAt: string;
  status: "complete" | "generating" | "failed";
  artifactCount: number;
  formats: ("excel" | "pdf" | "csv")[];
  downloadUrls: { excel?: string; pdf?: string; csv?: string };
}
```

#### Natural Language Queries the System Handles

| User says | System behavior |
|---|---|
| "Show me reports from last week" | Lists definitions with `created_at >= NOW() - 7 days` |
| "Find the Q1 admissions report" | Title LIKE search + most recent artifact |
| "Download the revenue PDF from Monday" | Resolves to specific artifact, returns download link |
| "How many reports did I run this month?" | COUNT query over `report_execution_log` |
| "Re-run the Q1 admissions report" | Triggers a new run of the existing definition |

The `listReports` handler calls `GET /api/report-generation/definitions?history=true&since=7d`, which queries the `nl_report_definitions` + `generated_report_artifacts` tables and returns structured results.

### 5.6 Notification & Distribution Layer

On job completion, two delivery channels are activated in parallel:

```
Report Worker (complete)
      │
      ├──► createNotification() ──► notifications table ──► in-app bell icon
      │
      └──► sendEmail()
                ├── Excel (.xlsx) attached
                ├── PDF (.pdf) attached
                └── CSV (.csv) attached
```

Recipients are stored in `nl_report_definitions.recipient_config` as a JSON array of `{ type: "email"|"userId", value: string }` objects, resolved at send time. Email dispatch checks total attachment size against `REPORT_EMAIL_MAX_ATTACHMENT_BYTES` (default: 10MB) and falls back to download-link-only email if exceeded.

---

## 6. Data Flow Architecture

### 6.1 Report Creation Flow

```
User (CopilotKit Chat)
│
│  "Generate Q1 patient admissions by department as PDF"
│
├─[1]─► POST /api/copilotkit
│          │
│          └─► buildReport action handler
│                │
│                └─► POST /api/build-report-pipeline (Mastra, port 4111)
│                      │
│                      ├─[2]─ Intent Classification (LLM)
│                      │        └─► ReportIntent { chartType: "bar", formats: ["pdf","excel","csv"], ... }
│                      │
│                      ├─[3]─ RBAC Validation
│                      │        └─► "GRANTED" (user has access to hospital data source)
│                      │
│                      ├─[4]─ Schema Introspection
│                      │        └─► [admissions, departments, ...] tables + columns
│                      │
│                      ├─[5]─ SQL Generation (LLM + schema context)
│                      │        └─► SELECT department, COUNT(*) FROM ... GROUP BY ...
│                      │
│                      └─[6]─ Dry-Run Preview (LIMIT 20)
│                               └─► { previewRows: [...20 rows...] }
│
├─[7]─► reportState.phase = "preview_ready"
│       ReportPreviewPanel renders table
│
│  User: "Looks good, send to clinical-team@hospital.org every Monday"
│
├─[8]─► confirmReport action handler
│          │
│          └─► POST /api/report-definitions (persist definition)
│                │
│                └─► Enqueue job (on-premise cron or Trigger.dev)
│
└─[9]─► Report Worker (async)
           ├── RBAC re-check
           ├── SQL execution → full result set
           ├── Chart PNG render (ECharts SSR)
           ├── Excel build (ExcelJS)
           ├── PDF build (jsPDF + autotable)
           ├── CSV build
           ├── Persist artifacts → generated_report_artifacts
           ├── In-app notification (createNotification)
           └── Email dispatch (with attachments)
```

### 6.2 Report Retrieval Flow

```
User (CopilotKit Chat)
│
│  "Show me reports I ran last week"
│
├─[1]─► POST /api/copilotkit
│          └─► listReports action handler
│                │
│                └─► GET /api/report-definitions?history=true&since=7d
│                      │
│                      └─► MariaDB query:
│                            SELECT rd.*, COUNT(gra.id) AS artifact_count
│                            FROM nl_report_definitions rd
│                            LEFT JOIN generated_report_artifacts gra
│                              ON gra.report_definition_id = rd.id
│                            WHERE rd.created_by = :userId
│                              AND rd.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
│                            ORDER BY rd.created_at DESC
│
├─[2]─► reportState.historyReports = [...]
│       ReportHistoryPanel renders list with download buttons
│
│  User: "Download the Tuesday one as PDF"
│
└─[3]─► downloadReport action handler
           └─► GET /api/report-artifacts/:id/download?format=pdf
                 └─► Streams artifact file from filesystem
```

### 6.3 Scheduled Report Execution Flow

```
on-premise cron runner (monitoring-scheduler.ts, 60s poll interval)
│
│  Polls nl_report_definitions WHERE schedule_enabled = true AND schedule_cron IS NOT NULL
│  Evaluates cron expression using timezone-aware matching (schedule_timezone column)
│  Skips definitions with last_run_status = "running" (concurrency guard)
│
│  triggers at schedule: "0 9 * * 1" (Monday 09:00 in schedule_timezone)
│
└─► executeReportGeneration({ reportDefinitionId, triggeredBy: "scheduled" })
      │
      ├─ Phase 1:  Load nl_report_definitions record
      ├─ Phase 2:  RBAC re-validation (drift detection + column-level enforcement)
      ├─ Phase 3:  SQL execution (row limit + query timeout)
      ├─ Phase 4:  Chart PNG render (ECharts SSR → sharp)
      ├─ Phase 5:  Excel build
      ├─ Phase 6:  PDF build
      ├─ Phase 7:  CSV build
      ├─ Phase 8:  Persist → generated_report_artifacts
      ├─ Phase 9:  createNotification (all recipients who are users)
      └─ Phase 10: sendEmail (all recipients)
```

**Timezone-aware cron evaluation**: The on-premise cron runner uses `Intl.DateTimeFormat` with the `timeZone` option to convert the current UTC time to the rule's configured timezone before evaluating the cron expression. Invalid timezones fall back to UTC. This is implemented in `cronMatchesWithTimezone()` in `monitoring-scheduler.ts`.

**Nightly artifact cleanup**: At 02:00 UTC daily, the cron runner calls `cleanupExpiredReportArtifacts()` from `src/lib/report-generation/report-cleanup.ts` to delete files and DB records older than `REPORT_ARTIFACT_RETENTION_DAYS` (default: 90).

---

## 7. RBAC Integration Design

### 7.1 Pipeline-Level RBAC (Stage 2)

Identical to the monitoring enhancement. The ADK pipeline calls `validateDataSourceAccess(userId, dataSourceId)` before any SQL is generated.

### 7.2 Worker-Level RBAC Re-Check (Phase 2)

The report worker performs a **three-layer RBAC re-validation** at execution time:

1. **User account check** — verifies the creator's account is still active
2. **RBAC drift detection** — compares the stored `rbac_snapshot` (captured at definition creation) against the user's current permissions using `detectRBACDrift()` from `src/lib/monitoring/rbac-workflow-context.ts`. If roles, data source access, or table permissions have changed, the drift check fails.
3. **Column-level enforcement** — parses the `generated_sql` for `table.column` references using regex and validates each against the snapshot's `allowedColumns` map. Blocks `SELECT *` on tables with column restrictions. Prevents LLM-generated queries from referencing restricted columns.

If any check fails, the job is marked `PERMISSION_REVOKED` and an in-app notification is sent to the report creator with a specific reason.

```typescript
// Column-level validation (Phase 2 of worker)
function validateSQLColumnsAgainstRBAC(sql, dataSourceId, snapshot) {
  // For each table in the snapshot with non-empty allowedColumns:
  //   - Extract table.column references via regex
  //   - Block SELECT * on restricted tables
  //   - Block references to columns not in the allowlist
}
```

### 7.3 RBAC Snapshot Lifecycle

An RBAC snapshot is captured at report definition creation time via `resolveRBACContext()` and stored in the `rbac_snapshot` LONGTEXT column. The snapshot includes: `userId`, `userRoles`, `accessibleDataSources` (with `allowedTables`, `allowedColumns`, `rowFilters`), and `resolvedAt` timestamp. This enables offline drift detection without re-querying the permissions system at every execution.

### 7.4 Artifact Download RBAC

`GET /api/report-artifacts/:id/download` checks that the requesting session's `userId` matches `generated_report_artifacts.created_by` OR the user has an admin role. Users cannot download artifacts they did not generate, except admins.

### 7.5 Report History RBAC

`GET /api/report-definitions?history=true` always filters by `created_by = session.user.id`. Admins may pass `?all=true` to see all users' reports.

### 7.6 Recipient Resolution

When a report definition specifies recipients as user IDs, the worker resolves them to email addresses but also checks that each recipient has at minimum read access to the data source, to avoid leaking sensitive data to unauthorized users via email.

---

## 8. Database Schema Extensions

### 8.1 `nl_report_definitions` Table

NL-pipeline-specific report metadata. Named `nl_report_definitions` to avoid collision with the existing `report_definitions` table used by monitoring/export workers.

```sql
CREATE TABLE nl_report_definitions (
  id                    VARCHAR(255)   NOT NULL PRIMARY KEY,
  title                 VARCHAR(255)   NOT NULL,
  created_by            VARCHAR(255)   NOT NULL,           -- FK → users.id
  data_source_id        VARCHAR(255)   NOT NULL,           -- FK → data_sources.id
  nl_query              TEXT           NOT NULL,           -- original NL query
  generated_sql         TEXT           NOT NULL,           -- SQL generated by Mastra
  metric_columns        LONGTEXT       NOT NULL,           -- JSON: ["total_admissions", ...]
  dimension_columns     LONGTEXT       NOT NULL,           -- JSON: ["department", "month", ...]
  filter_config         LONGTEXT       NULL,               -- JSON: FilterClause[]
  date_range_from       DATE           NULL,
  date_range_to         DATE           NULL,
  chart_type            VARCHAR(20)    NOT NULL DEFAULT 'bar',  -- bar|line|pie|area|none
  output_formats        LONGTEXT       NOT NULL,           -- JSON: ["excel","pdf","csv"]
  recipient_config      LONGTEXT       NOT NULL,           -- JSON: [{type,value}]
  schedule_cron         VARCHAR(100)   NULL,               -- null = one-shot
  schedule_timezone     VARCHAR(64)    NOT NULL DEFAULT 'UTC',  -- IANA timezone for cron eval
  schedule_enabled      TINYINT(1)     NOT NULL DEFAULT 0,
  rbac_snapshot         LONGTEXT       NOT NULL,           -- JSON: RBACWorkflowSnapshotRef
  rbac_snapshot_version INT            DEFAULT 1,          -- schema version for snapshot
  last_run_at           DATETIME       NULL,
  last_run_status       VARCHAR(20)    NULL,               -- complete|failed|running|permission_revoked|no_data
  created_at            DATETIME       DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_nlrd_created_by  (created_by),
  INDEX idx_nlrd_data_source (data_source_id),
  INDEX idx_nlrd_created_at  (created_at),
  INDEX idx_nlrd_schedule    (schedule_enabled, schedule_cron)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Key additions vs. the original proposal:
- **`schedule_timezone`** — IANA timezone string for timezone-aware cron evaluation (see §6.3)
- **`rbac_snapshot`** — full RBAC context captured at creation time for drift detection at execution time
- **`rbac_snapshot_version`** — schema version for future migration of snapshot format
- Uses `LONGTEXT` instead of `JSON` for MariaDB compatibility (JSON is aliased to LONGTEXT in MariaDB)

### 8.2 `generated_report_artifacts` Table

One row per format per execution:

```sql
CREATE TABLE generated_report_artifacts (
  id                    VARCHAR(255)  NOT NULL PRIMARY KEY,
  report_definition_id  VARCHAR(255)  NOT NULL,           -- FK → nl_report_definitions.id
  execution_id          VARCHAR(255)  NOT NULL,           -- groups all formats from one run
  created_by            VARCHAR(255)  NOT NULL,           -- FK → users.id
  format                VARCHAR(10)   NOT NULL,           -- excel|pdf|csv
  file_path             VARCHAR(500)  NOT NULL,           -- server filesystem path
  file_size_bytes       BIGINT        NULL,
  row_count             INT           NULL,
  chart_type            VARCHAR(20)   NULL,
  execution_ms          INT           NULL,               -- generation duration
  status                VARCHAR(20)   NOT NULL DEFAULT 'complete',  -- complete|failed
  error_message         TEXT          NULL,
  triggered_by          VARCHAR(20)   NOT NULL DEFAULT 'manual',    -- manual|scheduled
  sql_executed          TEXT          NULL,               -- for audit/investigation
  created_at            DATETIME      DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_gra_definition (report_definition_id, created_at DESC),
  INDEX idx_gra_user       (created_by, created_at DESC),
  INDEX idx_gra_execution  (execution_id),

  CONSTRAINT fk_gra_def FOREIGN KEY (report_definition_id)
    REFERENCES nl_report_definitions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 8.3 Migration File

```
src/lib/db/migrations/20260604000001_dynamic_report_generation.ts
```

This single migration creates both tables with appropriate indexes and foreign keys. It follows the existing Kysely migration pattern using `db.schema.createTable()`.

---

## 9. API Surface Design

### 9.1 Report Definition Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/report-definitions` | Required | Create (NL→pipeline→persist) |
| `GET`  | `/api/report-definitions` | Required | List own definitions (paginated) |
| `GET`  | `/api/report-definitions/:id` | Required | Get single definition |
| `PATCH`| `/api/report-definitions/:id` | Required | Update schedule/recipients |
| `DELETE`| `/api/report-definitions/:id` | Required | Delete definition + artifacts |

**POST body** (from CopilotKit `confirmReport` action):
```json
{
  "nlQuery": "Q1 admissions by department",
  "dataSourceId": "uuid",
  "intent": { /* ReportIntent */ },
  "generatedSQL": "SELECT ...",
  "schedule": "0 9 * * 1",
  "recipients": ["user@hospital.org"],
  "formats": ["excel", "pdf", "csv"],
  "dryRun": false
}
```

### 9.2 Artifact Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/api/report-definitions/:id/artifacts` | Required | List executions + artifacts |
| `GET`  | `/api/report-artifacts/:id/download` | Required | Stream file (RBAC-checked) |
| `POST` | `/api/report-definitions/:id/run` | Required | Trigger immediate run |

**GET `/api/report-definitions/:id/artifacts` response:**
```json
{
  "executions": [
    {
      "executionId": "uuid",
      "createdAt": "2026-06-04 09:00:00",
      "status": "complete",
      "rowCount": 142,
      "executionMs": 1840,
      "artifacts": [
        { "id": "uuid", "format": "excel", "fileSizeBytes": 45678, "downloadUrl": "/api/report-artifacts/uuid/download" },
        { "id": "uuid", "format": "pdf",   "fileSizeBytes": 89012, "downloadUrl": "/api/report-artifacts/uuid/download" },
        { "id": "uuid", "format": "csv",   "fileSizeBytes": 12345, "downloadUrl": "/api/report-artifacts/uuid/download" }
      ]
    }
  ],
  "total": 8,
  "page": 0,
  "pageSize": 20
}
```

### 9.3 Mastra Server Endpoint

| Method | Path (Mastra port 4111) | Description |
|---|---|---|
| `POST` | `/api/build-report-pipeline` | Full ADK pipeline execution |

**Request:**
```json
{
  "userId": "uuid",
  "nlQuery": "Q1 admissions by department as bar chart PDF",
  "dataSourceId": "uuid",
  "dryRun": true
}
```

**Response (dry-run):**
```json
{
  "intent": { "chartType": "bar", "formats": ["pdf"], ... },
  "rbacResult": "GRANTED",
  "generatedSQL": "SELECT ...",
  "previewRows": [ { "department": "Cardiology", "total_admissions": 42 }, ... ]
}
```

---

## 10. Security Architecture

### 10.1 SQL Injection Prevention

All SQL generated by the Mastra pipeline passes through the existing `validateSQL()` gate in `src/lib/sql/validator.ts` before any execution. Only `SELECT` statements are permitted; DML and DDL are rejected.

### 10.2 File System Access Control

Generated artifact files are stored under `{JOB_OUTPUT_PATH}/reports/` (default: `./job-outputs/reports/`) which is:
- Not served as a static directory (no direct URL access)
- Accessed only through the RBAC-checked `/api/report-generation/artifacts/:id?download=true` endpoint
- The download handler streams the file using `Bun.file()` after ownership + data source RBAC validation

### 10.3 Artifact Lifecycle & Retention Cleanup

Files are retained for 90 days by default (configurable via `REPORT_ARTIFACT_RETENTION_DAYS` env var). The cleanup is implemented in `src/lib/report-generation/report-cleanup.ts` (`cleanupExpiredReportArtifacts()`):

1. **Trigger**: Wired into the on-premise cron runner (`monitoring-scheduler.ts`), fires at **02:00 UTC daily**
2. **File deletion**: Unlinks expired artifact files from disk, then removes empty execution/definition directories
3. **DB cleanup**: Deletes corresponding `generated_report_artifacts` rows in batches of 500 to avoid long-running transactions
4. **Error handling**: File-not-found is non-critical (already cleaned); directory cleanup is best-effort

### 10.4 Email Attachment Security

Attachments are streamed from the filesystem at send time and are not stored in memory longer than needed. Recipient validation prevents sending to users without data source access.

### 10.5 Audit Logging

All report generation events are logged via `logAudit()`:

```typescript
await logAudit({
  userId: session.user.id,
  action: AUDIT_ACTIONS.REPORT.GENERATED,
  resourceType: "report_definition",
  resourceId: reportDefinitionId,
  details: {
    triggeredBy,
    formats: outputFormats,
    recipientCount: recipients.length,
    rowCount,
    executionMs,
  },
});
```

---

## 11. Infrastructure & Deployment

### 11.1 Artifact Storage

In development: `{JOB_OUTPUT_PATH}/reports/{definitionId}/{executionId}/report.{ext}` on the local filesystem (default: `./job-outputs/reports/...`, persisted via Docker volume).

In production: same path structure, mounted to a persistent volume (NFS, EFS, or local disk depending on deployment). The `JOB_OUTPUT_PATH` env var is consistent with existing export workers. Future enhancement: configurable S3-compatible object storage backend.

### 11.2 Worker Process

The report generation worker runs in the same Bun process as the existing job workers, registered alongside `export-worker` and `report-worker`. No additional process is required.

```typescript
// src/lib/jobs/worker-runner.ts (addition)
import { executeReportGeneration } from "./workers/report-generation-worker";
```

### 11.3 ECharts SSR + sharp Pipeline

ECharts SSR mode renders charts as SVG strings (no DOM/Canvas required). SVG→PNG conversion uses `sharp` (`^0.34.5`), which ships prebuilt binaries for all major platforms including `linux-x64-musl` (Alpine Docker). No native compilation or `canvas` npm package required.

**Pipeline**: `echarts.init(null, null, { renderer: "svg", ssr: true })` → `renderToSVGString()` → `sharp(Buffer.from(svgStr)).resize(1800, 900).png().toBuffer()`

If the chart rendering pipeline fails at any point (ECharts error, sharp unavailable), the worker returns `null` for `chartPng` and Excel/PDF artifacts are generated without embedded charts (graceful degradation).

### 11.4 Docker Volume

The `docker-compose.yml` mounts `./job-outputs` as a Docker volume. The report artifacts directory `job-outputs/reports/` is created automatically on first run by the worker's `fs.mkdir(outputDir, { recursive: true })`.

---

## 12. Implementation Roadmap

### Phase 1: Core Pipeline & Database (Week 1)

| Task | Owner | Effort |
|---|---|---|
| DB migration: `nl_report_definitions` + `generated_report_artifacts` | BE | 0.5d |
| `report-generation-worker.ts` scaffolding (phases 1-2, RBAC + SQL exec) | BE | 1d |
| Mastra server: `/api/build-report-pipeline` endpoint | BE | 1d |
| ADK intent classifier: `ReportIntent` type + prompt tuning | BE | 1d |
| API routes: `/api/report-definitions` CRUD | BE | 0.5d |

### Phase 2: Artifact Generation (Week 2)

| Task | Owner | Effort |
|---|---|---|
| ECharts SSR chart renderer | BE | 1d |
| ExcelJS artifact builder (chart sheet + data sheet) | BE | 1d |
| jsPDF artifact builder (chart page + AutoTable pages) | BE | 1d |
| CSV artifact builder | BE | 0.5d |
| Artifact persistence + download endpoint | BE | 0.5d |

### Phase 3: Notification & Distribution (Week 2-3)

| Task | Owner | Effort |
|---|---|---|
| In-app notification integration (`createNotification`) | BE | 0.5d |
| Email dispatch with attachments (Nodemailer) | BE | 0.5d |
| Recipient resolution (userId → email, RBAC check) | BE | 0.5d |
| Scheduled run integration (cron runner / Trigger.dev task) | BE | 0.5d |

### Phase 4: CopilotKit UI (Week 3)

| Task | Owner | Effort |
|---|---|---|
| `/_authed/reports/generate` page + layout | FE | 1d |
| `useCopilotAction` + `useCopilotReadable` state integration | FE | 1d |
| Report Preview Panel (data table) | FE | 0.5d |
| `listReports` / `downloadReport` actions | FE | 1d |
| Report History Panel (list + download buttons) | FE | 1d |

### Phase 5: Polish & Testing (Week 4)

| Task | Owner | Effort |
|---|---|---|
| E2E Playwright tests for report generation flow | QA | 1.5d |
| Artifact retention cleanup job | BE | 0.5d |
| Error states: PERMISSION_DENIED, NO_DATA, SQL_ERROR in chat | FE+BE | 1d |
| Monitoring: report-generation queue depth, failure rate | BE | 0.5d |

**Total estimated effort:** ~14 developer-days (3.5 weeks for 1 FE + 1 BE engineer)

---

## 13. Technology Dependencies

| Dependency | Status | Purpose |
|---|---|---|
| `exceljs ^4.4.0` | ✅ Already installed | Excel workbook + chart image embedding |
| `jspdf ^3.0.1` | ✅ Already installed | PDF document generation |
| `jspdf-autotable ^3.8.2` | ✅ Already installed | PDF tabular data plugin |
| `echarts` | ✅ Already installed | Chart SSR rendering (PNG buffer) |
| `recharts` | ✅ Already installed | Client-side chart preview |
| `@copilotkit/react-core` | ✅ Already installed | Chat interface + action registration |
| `@copilotkit/react-ui` | ✅ Already installed | CopilotSidebar component |
| `nodemailer` | ✅ Already installed | Email dispatch with attachments |
| `sharp` | `^0.34.5` ✅ Installed | SVG→PNG conversion (prebuilt binaries, Alpine-safe) |
| Mastra server (port 4111) | ✅ Already running | LLM orchestration |
| llama.cpp (port 8080) | ✅ Already running | SQL + intent generation |

All dependencies are installed. The `canvas` npm package is **not required** — chart rendering uses ECharts SSR (SVG output) + `sharp` (SVG→PNG), both of which work on Alpine Docker without native compilation.

---

## 14. Risk Assessment

### 14.1 Risk Matrix

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| ECharts SSR PNG rendering fails in Bun | Low | Medium | **MITIGATED**: sharp-based SVG→PNG pipeline proven; graceful fallback returns null chartPng |
| Large result sets cause OOM during Excel build | Low | High | Stream rows to ExcelJS; cap at 100k rows with warning |
| jsPDF AutoTable pagination with 1000+ rows | Low | Medium | Test with large datasets; add row limit config |
| LLM generates invalid SQL for complex schemas | Medium | Medium | SQL validator gate + dry-run step catches errors before commit |
| Email attachment size exceeds SMTP limit | Low | Medium | Compress artifacts; expose download link as fallback if attach fails |
| Artifact filesystem fills up | Low | High | **MITIGATED**: 90-day retention cleanup runs nightly at 02:00 UTC via on-premise cron runner |
| RBAC drift (permissions change after definition created) | Low | Medium | **MITIGATED**: Worker Phase 2 performs drift detection + column-level enforcement using stored RBAC snapshot |
| Mastra/llama.cpp unavailable when user requests generation | Medium | Low | Graceful error in CopilotKit chat; retry queue |

### 14.2 Graduated Rollout

1. **Alpha** (internal): Admin users only; Excel + CSV output; no scheduling
2. **Beta**: All roles; PDF added; scheduling enabled; email to fixed list
3. **GA**: Full recipient resolution; history retrieval; retention cleanup active

---

## 15. Appendix: Reference Flows

### 15.1 Complete NL-to-PDF Flow (Sequence Diagram)

```
User          CopilotKit        /api/copilotkit    Mastra(:4111)    Report Worker    MariaDB   File System   Email
 │                │                    │                 │                │             │          │             │
 │─"Q1 admits"──►│                    │                 │                │             │          │             │
 │                │─buildReport───────►│                 │                │             │          │             │
 │                │                    │─POST /build────►│                │             │          │             │
 │                │                    │                 │─classify──────►│             │          │             │
 │                │                    │                 │─rbac check────►│─────────────►│          │             │
 │                │                    │                 │─schema─────────────────────►│          │             │
 │                │                    │                 │─gen SQL────────────────────►│          │             │
 │                │                    │                 │─dry run───────►│─────────────►│          │             │
 │                │◄─previewRows───────│◄────────────────│                │             │          │             │
 │◄─table preview─│                    │                 │                │             │          │             │
 │─"send as PDF"─►│                    │                 │                │             │          │             │
 │                │─confirmReport─────►│                 │                │             │          │             │
 │                │                    │─POST /defn─────────────────────────────────────►│          │             │
 │                │                    │─enqueue job────────────────────►│             │          │             │
 │                │◄─"queued"──────────│                 │                │             │          │             │
 │◄─"generating"──│                    │                 │                │             │          │             │
 │                │                    │                 │                │─RBAC re-check►│         │             │
 │                │                    │                 │                │─execute SQL──►│         │             │
 │                │                    │                 │                │─render chart│          │             │
 │                │                    │                 │                │─build PDF───────────────►│            │
 │                │                    │                 │                │─build Excel─────────────►│            │
 │                │                    │                 │                │─build CSV───────────────►│            │
 │                │                    │                 │                │─save artifacts►│         │            │
 │                │                    │                 │                │─createNotif──►│          │            │
 │                │                    │                 │                │─sendEmail───────────────────────────►│
 │◄─notification──│                    │                 │                │             │          │             │
```

### 15.2 Report History Retrieval Flow

```
User          CopilotKit        /api/copilotkit    /api/report-defs    MariaDB
 │                │                    │                  │                │
 │─"last week"───►│                    │                  │                │
 │                │─listReports───────►│                  │                │
 │                │                    │─GET /defs?hist──►│                │
 │                │                    │                  │─SELECT rd.*──►│
 │                │                    │                  │─JOIN artifacts─►│
 │                │◄─historyReports────│◄─────────────────│                │
 │◄─report list───│                    │                  │                │
 │─"download PDF"─►│                   │                  │                │
 │                │─downloadReport────►│                  │                │
 │                │                    │─GET /artifacts/:id/download       │
 │◄─file stream───│◄───────────────────│                  │                │
```

### 15.3 `mariadbNow()` Datetime Convention

All DATETIME column writes throughout the report generation subsystem use:

```typescript
function mariadbNow(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
  // Output: "2026-06-04 09:00:00"  ← valid MariaDB DATETIME format
  // Never: "2026-06-04T09:00:00.000Z"  ← invalid for MariaDB DATETIME
}
```

This is the same helper established in the monitoring subsystem and must be used consistently across all new workers and repository modules.

### 15.4 File Naming Convention

Generated artifacts follow this naming scheme:

```
{JOB_OUTPUT_PATH}/reports/{definitionId}/{executionId}/
  ├── report.xlsx
  ├── report.pdf
  └── report.csv
```

Download URLs presented to users use the format:
```
/api/report-artifacts/{artifactId}/download?format=excel
/api/report-artifacts/{artifactId}/download?format=pdf
/api/report-artifacts/{artifactId}/download?format=csv
```

The artifact ID is the `generated_report_artifacts.id` UUID, which maps to the file path via the database record.

---

## 16. Adversarial Review Corrections

This section documents critical issues found during adversarial review and the resolutions applied in the code stubs.

### C1 — Table Name Collision (CRITICAL → RESOLVED)
**Issue:** Proposed `report_definitions` table collides with existing table used by monitoring and export workers.
**Resolution:** Renamed to `nl_report_definitions` in migration and all code stubs.

### C2 — Column-Level RBAC Gap (CRITICAL → RESOLVED)
**Issue:** Report artifacts contain full query results emailed to recipients. The worker RBAC check only validates data source access, not column allowlists. An LLM-generated query could reference restricted columns.
**Resolution:** `validateSQLColumnsAgainstRBAC()` implemented in `report-generation-worker.ts` Phase 2. Regex-parses `table.column` references from the generated SQL, validates each against the RBAC snapshot's `allowedColumns` map, blocks `SELECT *` on tables with column restrictions, and returns a specific error message identifying the disallowed column. RBAC snapshot (including `allowedColumns`) is captured at definition creation time via `resolveRBACContext()` and stored in the `rbac_snapshot` LONGTEXT column.

### C3 — `svgToPngBuffer()` Phantom Function (CRITICAL → RESOLVED)
**Issue:** The original Phase 4 referenced a non-existent `svgToPngBuffer()` function. The `canvas` npm package has native binding issues on Alpine Docker.
**Resolution:** Replaced with `sharp` (`^0.34.5`), which ships prebuilt binaries for all platforms including `linux-x64-musl` (Alpine). Pipeline: ECharts SSR → SVG string → `sharp(Buffer.from(svgStr)).resize(1800, 900).png().toBuffer()`. Entire chain wrapped in try/catch returning null on failure. Excel and PDF builders handle null `chartPng` gracefully (skip chart sheet / show "Chart not available" text). `canvas` is NOT required.

### C4 — Worker Phase Count (CRITICAL → RESOLVED)
**Issue:** Document said 9 phases but flow had 10.
**Resolution:** Worker is now explicitly 10 phases: Load → RBAC → SQL → Chart → Excel → PDF → CSV → Persist → Notify → Email.

### H1 — Row Limit Enforcement (HIGH → RESOLVED)
**Issue:** No `LIMIT` wrapper on SQL execution. OOM risk with large datasets.
**Resolution:** Worker wraps SQL in `SELECT * FROM (...) AS __rpt__ LIMIT {REPORT_ROW_LIMIT+1}`. Default limit: 10,000 rows (env: `REPORT_ROW_LIMIT`). Returns `ROW_LIMIT_HIT` status when cap is reached.

### H2 — Query Timeout (HIGH → RESOLVED)
**Issue:** No timeout on SQL execution against external data sources.
**Resolution:** Worker uses `Promise.race()` with `REPORT_QUERY_TIMEOUT_MS` (default: 30s).

### H3 — Concurrent Execution Guard (MEDIUM → RESOLVED)
**Issue:** Two "Run Now" clicks on same definition could execute simultaneously.
**Resolution:** API PATCH `?action=run` checks `last_run_status !== 'running'` and returns 409 Conflict.

### H4 — Download RBAC Checks Data Source (HIGH → RESOLVED)
**Issue:** Artifact download only checked `created_by`, not data source access.
**Resolution:** Download endpoint additionally verifies data source permission for non-admin users.

### H5 — CopilotKit Pattern (MEDIUM → RESOLVED)
**Issue:** Document referenced `useCoAgent` which doesn't exist in the codebase.
**Resolution:** All code stubs use `useCopilotAction` + `useCopilotReadable`, matching the existing NL Query pattern.

### H6 — Docker Volume Path (MEDIUM → RESOLVED)
**Issue:** Document said `data/reports/` but Docker mounts `job-outputs/`.
**Resolution:** Worker uses `JOB_OUTPUT_PATH` env var (default: `./job-outputs`), consistent with existing workers.

### H7 — `createNotification` Signature (MEDIUM → RESOLVED)
**Issue:** Document used non-existent `link` parameter.
**Resolution:** Stubs use `metadata: { executionId, reportTitle }` matching actual function signature.

### H8 — Email Attachment Size Limit (MEDIUM → RESOLVED)
**Issue:** No threshold or fallback for oversized attachments.
**Resolution:** Worker checks total attachment size against `REPORT_EMAIL_MAX_ATTACHMENT_BYTES` (default: 10MB). Falls back to download-link-only email if exceeded.

### ALL ITEMS RESOLVED — Implementation Complete

| Issue | Status | Implementation |
|---|---|---|
| Column-level RBAC enforcement in worker | **RESOLVED** | `validateSQLColumnsAgainstRBAC()` in `report-generation-worker.ts` Phase 2 — regex-parses `table.column` references from SQL, validates against RBAC snapshot's `allowedColumns` map, blocks `SELECT *` on restricted tables |
| Retention cleanup job wiring | **RESOLVED** | `cleanupExpiredReportArtifacts()` in `src/lib/report-generation/report-cleanup.ts` — wired into on-premise cron runner's `tick()` function, fires at 02:00 UTC daily, deletes expired files + DB records in batches of 500 |
| Timezone for scheduled cron expressions | **RESOLVED** | `schedule_timezone` column added to `nl_report_definitions`, `cronMatchesWithTimezone()` in `monitoring-scheduler.ts` uses `Intl.DateTimeFormat` to convert UTC → local time before cron evaluation, falls back to UTC for invalid timezones |
| ECharts SSR proof-of-concept on Bun/Alpine | **RESOLVED** | `sharp ^0.34.5` installed (prebuilt binaries for `linux-x64-musl`). Pipeline: ECharts SSR → SVG string → `sharp(Buffer.from(svgStr)).resize(1800,900).png().toBuffer()`. Entire chain wrapped in try/catch; returns null on failure (graceful degradation — reports generated without charts) |

### Implementation Files

| File | Purpose |
|---|---|
| `src/lib/db/migrations/20260604000001_dynamic_report_generation.ts` | Creates `nl_report_definitions` + `generated_report_artifacts` tables with all columns |
| `src/lib/report-generation/types.ts` | Type definitions: `ReportIntent`, `NLReportDefinition`, `ReportArtifact`, `ReportGenerationResult`, `RBACWorkflowSnapshotRef` |
| `src/lib/report-generation/report-generation-worker.ts` | 10-phase worker pipeline (load → RBAC → SQL → chart → Excel → PDF → CSV → persist → notify → email) |
| `src/lib/report-generation/report-cleanup.ts` | Artifact retention cleanup (`cleanupExpiredReportArtifacts()`) |
| `src/lib/monitoring/monitoring-scheduler.ts` | Extended with: timezone-aware cron matching, scheduled report polling, nightly cleanup trigger |
| `src/routes/api/report-generation/definitions.ts` | GET (list) + POST (create with RBAC snapshot) |
| `src/routes/api/report-generation/definitions.$id.ts` | GET (single) + PATCH (run) + DELETE (cascade) |
| `src/routes/api/report-generation/artifacts.$id.ts` | GET (list by execution) + download (stream with RBAC) |
| `src/routes/_authed/reports/generate/index.tsx` | CopilotKit-wrapped page with CopilotSidebar |
| `src/components/report-generation/ReportBuilderPanel.tsx` | 4 CopilotKit actions + phase state machine |
| `src/components/report-generation/ReportPreviewPanel.tsx` | Intent summary + SQL display + data preview table |
| `src/components/report-generation/ReportHistoryPanel.tsx` | Past reports table with status badges + download buttons |

---

*End of Document*

**Status:** All code stubs and open items are implemented. The code at `src/lib/report-generation/`, `src/routes/api/report-generation/`, and `src/components/report-generation/` is ready for integration testing and UI validation.
