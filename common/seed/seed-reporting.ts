#!/usr/bin/env bun
/**
 * Load a generated application into the reporting platform.
 *
 * Runs once, after both databases are up, and leaves the reporting platform
 * holding a working analytics workspace for whatever application was just
 * generated:
 *
 *   1. the generated application's database, registered as a data source with
 *      its connection details encrypted the way the platform expects
 *   2. that database's schema, introspected and cached — which is what the
 *      NL-query pipeline reads as context, and what the data-source screens
 *      list as entities
 *   3. every saved query, report, chart, dashboard and widget in the reporting
 *      pack derived from the model
 *
 * It is idempotent by name: run it twice and the second run updates in place.
 * That matters because it runs on every `docker compose up`, not only the first.
 *
 * This file is copied into the reporting application's own tree at image build
 * time, which is why it imports through `@/` — it uses that project's real
 * `getDb`, `encrypt` and `introspectAndCacheSchema` rather than a second
 * implementation of any of them. A seeder that wrote its own encryption or its
 * own schema-cache shape would drift from the reader, and the failure would be
 * a data source that exists and cannot be opened.
 */

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
/*
 * The same bcryptjs the platform's own sign-in uses.
 *
 * `src/lib/auth/better-auth.ts` keeps bcrypt rather than Better Auth's default
 * scrypt, because every password in an existing installation is a bcrypt hash.
 * A seeder that hashed with anything else would write accounts that cannot
 * sign in, and the failure would read as a wrong password.
 */
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db/config";
import { introspectAndCacheSchema } from "@/lib/mastra/schema-store";
import { encrypt } from "@/lib/security/encryption";
import type { DataSource } from "@/types/database";

// --- The pack, as reporting-pack.ts emits it ---------------------------------

interface SavedQuerySpec {
  key: string;
  name: string;
  description: string;
  sql: string;
}
interface ReportSpec {
  key: string;
  name: string;
  description: string;
  queryKey: string;
  columns: { field: string; label: string }[];
  pageSize: number;
}
interface ChartSpec {
  key: string;
  name: string;
  description: string;
  queryKey: string;
  chartType: string;
  xField: string;
  yField: string;
}
interface DashboardWidgetSpec {
  chartKey?: string;
  reportKey?: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
interface DashboardSpec {
  key: string;
  name: string;
  description: string;
  widgets: DashboardWidgetSpec[];
}
interface AccessRoleSpec {
  name: string;
  declaredAs: string;
  description: string;
  isAdmin: boolean;
  email: string;
  /** `bus_` tables this role may read. Empty means every table. */
  tables: string[];
}

interface ReportingPack {
  application: { name: string; description: string; model: string; databaseName: string };
  dataSource: { name: string; description: string; clientType: string };
  queries: SavedQuerySpec[];
  reports: ReportSpec[];
  charts: ChartSpec[];
  dashboards: DashboardSpec[];
  /** Absent in a pack built before roles were derived; treated as none. */
  access?: { roles: AccessRoleSpec[]; scoped: boolean };
}

// biome-ignore lint/suspicious/noExplicitAny: nine of this schema's tables are absent from the Database interface
type Db = any;

const PACK_PATH = process.env.REPORTING_PACK ?? "/pack/reporting-pack.json";
const APP_DB_URL = process.env.APP_DATABASE_URL ?? "";
const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");

function log(msg: string): void {
  console.log(`[seed] ${msg}`);
}

// --- Waiting -----------------------------------------------------------------

/**
 * Both databases, before anything else.
 *
 * `depends_on: service_healthy` covers the container, not the schema: the
 * reporting application bootstraps its own tables on first request, so a seeder
 * that starts the moment Postgres answers finds no `users` row to own anything
 * it writes. Hence a wait on the application's health endpoint as well.
 */
async function waitFor(label: string, check: () => Promise<boolean>, seconds = 180): Promise<void> {
  const deadline = Date.now() + seconds * 1000;
  let reported = false;
  while (Date.now() < deadline) {
    try {
      if (await check()) {
        if (reported) log(`${label}: ready`);
        return;
      }
    } catch {
      // Not up yet. Retrying is the whole point.
    }
    if (!reported) {
      log(`${label}: waiting…`);
      reported = true;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Timed out after ${seconds}s waiting for ${label}`);
}

async function pgReachable(url: string): Promise<boolean> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 3000 });
  try {
    await pool.query("select 1");
    return true;
  } finally {
    await pool.end().catch(() => {});
  }
}

/**
 * The generated application's tables, not merely its database.
 *
 * The application runs its own migrations at start, so an empty database means
 * "not migrated yet" rather than "nothing to report on". Introspecting then
 * would cache a schema with no tables in it, and every report would be built
 * against a data source the platform believes is empty.
 */
async function appSchemaReady(url: string): Promise<boolean> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const r = await pool.query(
      "select count(*)::int as n from information_schema.tables where table_schema='public' and table_name like 'bus\\_%'"
    );
    return (r.rows[0]?.n ?? 0) > 0;
  } finally {
    await pool.end().catch(() => {});
  }
}

// --- Owner -------------------------------------------------------------------

/**
 * Everything seeded here is owned by the bootstrap administrator, which
 * `bootstrapSchema()` creates when no users exist. Rows with no owner are
 * invisible to every screen that filters by ownership.
 */
async function adminUserId(db: Db): Promise<string> {
  const admin = await db
    .selectFrom("users")
    .select(["id", "email"])
    .orderBy("created_at", "asc")
    .executeTakeFirst();
  if (!admin) {
    throw new Error(
      "No users in the reporting database. The application bootstraps one on first start; the seeder ran too early."
    );
  }
  return admin.id as string;
}

// --- Upserts -----------------------------------------------------------------

async function upsertDataSource(
  db: Db,
  pack: ReportingPack,
  ownerId: string
): Promise<DataSource> {
  let url: URL;
  try {
    url = new URL(APP_DB_URL);
  } catch {
    // The message the URL parser gives here names neither the variable nor the
    // value, so it reads as a fault in the pack rather than in configuration.
    throw new Error(
      `APP_DATABASE_URL is not a URL the data source can be built from. ` +
        `Expected postgresql://user:password@host:port/database, got ${APP_DB_URL.replace(/:\/\/[^@]*@/, "://***@")}`
    );
  }
  const config = {
    host: url.hostname,
    port: Number(url.port || 5432),
    database: url.pathname.replace(/^\//, ""),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: false,
  };

  const stamp = now();
  const existing = await db
    .selectFrom("data_sources")
    .select("id")
    .where("name", "=", pack.dataSource.name)
    .executeTakeFirst();

  const values = {
    name: pack.dataSource.name,
    description: pack.dataSource.description,
    client_type: pack.dataSource.clientType,
    // Encrypted with the platform's own routine, so its own decrypt reads it.
    connection_config: encrypt(JSON.stringify(config)),
    is_active: true,
    updated_at: stamp,
  };

  if (existing) {
    await db.updateTable("data_sources").set(values).where("id", "=", existing.id).execute();
  } else {
    await db
      .insertInto("data_sources")
      .values({
        id: randomUUID(),
        ...values,
        is_editable: true,
        is_deleted: false,
        deleted_at: null,
        deleted_by: null,
        created_by: ownerId,
        created_at: stamp,
      })
      .execute();
  }

  const row = await db
    .selectFrom("data_sources")
    .selectAll()
    .where("name", "=", pack.dataSource.name)
    .executeTakeFirstOrThrow();
  return row as DataSource;
}

async function upsertQueries(
  db: Db,
  pack: ReportingPack,
  dataSourceId: string,
  ownerId: string
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  const stamp = now();
  for (const q of pack.queries) {
    const existing = await db
      .selectFrom("saved_queries")
      .select("id")
      .where("name", "=", q.name)
      .where("created_by", "=", ownerId)
      .executeTakeFirst();
    if (existing) {
      await db
        .updateTable("saved_queries")
        .set({
          description: q.description,
          data_source_id: dataSourceId,
          sql_content: q.sql,
          updated_at: stamp,
        })
        .where("id", "=", existing.id)
        .execute();
      ids.set(q.key, existing.id as string);
      continue;
    }
    const id = randomUUID();
    await db
      .insertInto("saved_queries")
      .values({
        id,
        name: q.name,
        description: q.description,
        data_source_id: dataSourceId,
        sql_content: q.sql,
        parameters_schema: null,
        is_validated: false,
        validation_result: null,
        is_deleted: false,
        deleted_at: null,
        deleted_by: null,
        created_by: ownerId,
        created_at: stamp,
        updated_at: stamp,
      })
      .execute();
    ids.set(q.key, id);
  }
  return ids;
}

async function upsertReports(
  db: Db,
  pack: ReportingPack,
  queryIds: Map<string, string>,
  ownerId: string
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  const stamp = now();
  for (const r of pack.reports) {
    const savedQueryId = queryIds.get(r.queryKey);
    if (!savedQueryId) continue;
    const values = {
      description: r.description,
      saved_query_id: savedQueryId,
      column_config: JSON.stringify(r.columns),
      pagination_config: JSON.stringify({ pageSize: r.pageSize, mode: "server" }),
      export_formats: JSON.stringify(["csv", "xlsx", "pdf"]),
      updated_at: stamp,
    };
    const existing = await db
      .selectFrom("report_definitions")
      .select("id")
      .where("name", "=", r.name)
      .where("created_by", "=", ownerId)
      .executeTakeFirst();
    if (existing) {
      await db.updateTable("report_definitions").set(values).where("id", "=", existing.id).execute();
      ids.set(r.key, existing.id as string);
      continue;
    }
    const id = randomUUID();
    await db
      .insertInto("report_definitions")
      .values({
        id,
        name: r.name,
        ...values,
        filter_config: null,
        sort_config: null,
        filename_template: null,
        color_theme: null,
        is_public: false,
        is_deleted: false,
        deleted_at: null,
        deleted_by: null,
        created_by: ownerId,
        created_at: stamp,
      })
      .execute();
    ids.set(r.key, id);
  }
  return ids;
}

async function upsertCharts(
  db: Db,
  pack: ReportingPack,
  queryIds: Map<string, string>,
  ownerId: string
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  const stamp = now();
  for (const c of pack.charts) {
    const savedQueryId = queryIds.get(c.queryKey);
    if (!savedQueryId) continue;
    const values = {
      description: c.description,
      saved_query_id: savedQueryId,
      chart_type: c.chartType,
      chart_config: JSON.stringify({
        title: { text: c.name },
        legend: { show: true, position: "bottom" },
        tooltip: { enabled: true },
      }),
      // The reader expects yAxis as a list: a chart may carry several series.
      data_mapping: JSON.stringify({
        xAxis: { field: c.xField, label: c.xField },
        yAxis: [{ field: c.yField, label: c.yField }],
      }),
      updated_at: stamp,
    };
    const existing = await db
      .selectFrom("chart_definitions")
      .select("id")
      .where("name", "=", c.name)
      .where("created_by", "=", ownerId)
      .executeTakeFirst();
    if (existing) {
      await db.updateTable("chart_definitions").set(values).where("id", "=", existing.id).execute();
      ids.set(c.key, existing.id as string);
      continue;
    }
    const id = randomUUID();
    await db
      .insertInto("chart_definitions")
      .values({
        id,
        name: c.name,
        ...values,
        refresh_interval: null,
        color_theme: null,
        is_public: false,
        is_deleted: false,
        deleted_at: null,
        deleted_by: null,
        created_by: ownerId,
        created_at: stamp,
      })
      .execute();
    ids.set(c.key, id);
  }
  return ids;
}

async function upsertDashboards(
  db: Db,
  pack: ReportingPack,
  chartIds: Map<string, string>,
  reportIds: Map<string, string>,
  ownerId: string
): Promise<number> {
  const stamp = now();
  let widgetCount = 0;

  for (const d of pack.dashboards) {
    // Every widget's id is minted here, before anything is written, because
    // two rows have to agree on it.
    //
    // react-grid-layout matches a layout entry to a rendered tile by the
    // tile's React key, and the dashboard renders `key={widget.id}` — the
    // widget's UUID. A layout keyed by the array index ("0", "1", …) matches
    // no tile at all, and the grid then falls back to its own default of one
    // column by one row for every child: eleven tiles 65px wide stacked in a
    // single column, each title clipped to a few letters. It looks like a CSS
    // problem and is a key mismatch.
    //
    // Widgets whose chart or report did not survive are dropped *before* the
    // layout is built, too. Leaving them in left the layout referring to tiles
    // that are never rendered — harmless to look at, and a gap in the grid
    // where a reader expects a tile.
    const placed = d.widgets
      .map((w) => ({
        w,
        id: randomUUID(),
        chartId: w.chartKey ? (chartIds.get(w.chartKey) ?? null) : null,
        reportId: w.reportKey ? (reportIds.get(w.reportKey) ?? null) : null,
      }))
      .filter((e) => e.chartId !== null || e.reportId !== null);

    const layout = {
      cols: { lg: 12, md: 10, sm: 6, xs: 4 },
      rowHeight: 100,
      layouts: {
        lg: placed.map((e) => ({ i: e.id, x: e.w.x, y: e.w.y, w: e.w.w, h: e.w.h })),
      },
    };

    let dashboardId: string;
    const existing = await db
      .selectFrom("dashboard_layouts")
      .select("id")
      .where("name", "=", d.name)
      .where("created_by", "=", ownerId)
      .executeTakeFirst();

    if (existing) {
      dashboardId = existing.id as string;
      await db
        .updateTable("dashboard_layouts")
        .set({
          description: d.description,
          layout_config: JSON.stringify(layout),
          updated_at: stamp,
        })
        .where("id", "=", dashboardId)
        .execute();
      // Widgets are replaced rather than merged: their positions are derived
      // together, so a half-updated set is a broken layout.
      await db.deleteFrom("dashboard_widgets").where("dashboard_id", "=", dashboardId).execute();
    } else {
      dashboardId = randomUUID();
      await db
        .insertInto("dashboard_layouts")
        .values({
          id: dashboardId,
          name: d.name,
          description: d.description,
          layout_config: JSON.stringify(layout),
          theme_config: null,
          refresh_config: null,
          is_public: false,
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
          created_by: ownerId,
          created_at: stamp,
          updated_at: stamp,
        })
        .execute();
    }

    for (const e of placed) {
      await db
        .insertInto("dashboard_widgets")
        .values({
          id: e.id,
          dashboard_id: dashboardId,
          widget_type: e.chartId ? "chart" : "report",
          report_id: e.reportId,
          chart_id: e.chartId,
          // The same id the layout entry carries. A widget that disagrees with
          // its own layout entry is the bug this pairing exists to prevent.
          position_config: JSON.stringify({
            i: e.id,
            x: e.w.x,
            y: e.w.y,
            w: e.w.w,
            h: e.w.h,
          }),
          widget_config: JSON.stringify({ title: e.w.title }),
          created_at: stamp,
          updated_at: stamp,
        })
        .execute();
      widgetCount++;
    }
  }
  return widgetCount;
}

// --- Roles -------------------------------------------------------------------

/**
 * Create a reporting account per role the model declared.
 *
 * These are *not* the application's accounts. The two products have separate
 * user tables, in separate databases, behind separate sign-in screens, and a
 * role means a different thing on each side: in the application it decides what
 * a user may do to a record, here it decides which tables their queries and
 * reports may read. The names line up so an administrator can tell which is
 * which; nothing else is shared, and neither password works on the other.
 *
 * The addresses are deliberately different for the same reason — the reporting
 * account for `sales_manager` is `sales.manager@<app>.reports.example.com`,
 * against the application's `sales.manager@<app>.example.com`. Identical
 * addresses would invite a reader to try one password on both.
 *
 * Idempotent by email and by name, like everything else here: it runs on every
 * `docker compose up`, not only the first.
 *
 * Two things are seeded per role, and they are different layers:
 *
 *   - a platform user + role + link, which is what signing in produces;
 *   - a `ds_role` scoped to this data source, with one `ds_entity_permissions`
 *     row per table the role may read. That is the part derived from `%%rbac`.
 */
async function upsertAccess(
  db: Db,
  pack: ReportingPack,
  dataSourceId: string,
  ownerId: string
): Promise<number> {
  const roles = pack.access?.roles ?? [];
  if (roles.length === 0) return 0;

  const stamp = now();
  // The password every seeded account shares, and the one the application's
  // own seeded accounts use. A demo whose nine accounts have nine passwords is
  // a demo nobody signs into twice.
  const passwordHash = bcrypt.hashSync("admin", 10);
  let seeded = 0;

  for (const role of roles) {
    // ── The platform account ────────────────────────────────────────────────
    //
    // The administrator already exists — `bootstrapSchema()` creates it before
    // anything here runs, and it owns every row this seeder wrote. Creating a
    // second user with that address would fail on the unique index; what it
    // still needs is the data-source role below, which bootstrap knows nothing
    // about.
    let userId: string;
    const existing = await db
      .selectFrom("users")
      .select("id")
      .where("email", "=", role.email)
      .executeTakeFirst();

    if (existing) {
      userId = existing.id as string;
    } else {
      userId = randomUUID().replace(/-/g, "");
      await db
        .insertInto("users")
        .values({
          id: userId,
          email: role.email,
          password_hash: passwordHash,
          display_name: role.name,
          avatar_url: null,
          is_active: true,
          created_at: stamp,
          updated_at: stamp,
        })
        .execute();

      // Better Auth reads the credential from `auth_accounts`, never from
      // `users.password_hash` — see the note in the platform's bootstrap. A
      // user without this row is rejected with a correct password.
      await db
        .insertInto("auth_accounts")
        .values({
          id: `cred_${userId}`.slice(0, 255),
          user_id: userId,
          account_id: userId,
          provider_id: "credential",
          password: passwordHash,
          access_token: null,
          refresh_token: null,
          id_token: null,
          access_token_expires_at: null,
          refresh_token_expires_at: null,
          scope: null,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .onConflict((oc: any) => oc.column("id").doNothing())
        .execute();
    }

    // ── The platform role ───────────────────────────────────────────────────
    //
    // `nl_query:*` and the report/chart/dashboard resources are what a
    // reporting user does. An administrator keeps whatever bootstrap gave it.
    if (!role.isAdmin) {
      const permissions = JSON.stringify(["nl_query:*", "report:view", "chart:view", "dashboard:view"]);
      let roleId: string;
      const existingRole = await db
        .selectFrom("roles")
        .select("id")
        .where("name", "=", role.name)
        .executeTakeFirst();

      if (existingRole) {
        roleId = existingRole.id as string;
        await db
          .updateTable("roles")
          .set({ description: role.description, permissions })
          .where("id", "=", roleId)
          .execute();
      } else {
        roleId = randomUUID().replace(/-/g, "");
        await db
          .insertInto("roles")
          .values({
            id: roleId,
            name: role.name,
            description: role.description,
            permissions,
            created_at: stamp,
          })
          .execute();
      }

      await db
        .insertInto("user_roles")
        .values({ user_id: userId, role_id: roleId, assigned_at: stamp })
        .onConflict((oc: any) => oc.doNothing())
        .execute();
    }

    // ── The data-source role ────────────────────────────────────────────────
    const existingDsRole = await db
      .selectFrom("ds_roles")
      .select("id")
      .where("data_source_id", "=", dataSourceId)
      .where("name", "=", role.name)
      .executeTakeFirst();

    let dsRoleId: string;
    if (existingDsRole) {
      dsRoleId = existingDsRole.id as string;
      await db
        .updateTable("ds_roles")
        .set({ description: role.description, is_active: true, updated_at: stamp })
        .where("id", "=", dsRoleId)
        .execute();
    } else {
      dsRoleId = randomUUID();
      await db
        .insertInto("ds_roles")
        .values({
          id: dsRoleId,
          data_source_id: dataSourceId,
          name: role.name,
          description: role.description,
          is_active: true,
          created_by: ownerId,
          created_at: stamp,
          updated_at: stamp,
        })
        .execute();
    }

    await db
      .insertInto("ds_user_roles")
      .values({
        data_source_id: dataSourceId,
        user_id: userId,
        ds_role_id: dsRoleId,
        assigned_at: stamp,
      })
      .onConflict((oc: any) => oc.doNothing())
      .execute();

    // ── What the role may read ──────────────────────────────────────────────
    //
    // Replaced rather than merged: the model is the source of truth for this,
    // so a permission removed from the model has to disappear here too.
    await db
      .deleteFrom("ds_entity_permissions")
      .where("data_source_id", "=", dataSourceId)
      .where("ds_role_id", "=", dsRoleId)
      .execute();

    // An empty list means the whole schema — that is what an administrator
    // gets, and writing a row per table for it would only go stale.
    for (const table of role.tables) {
      await db
        .insertInto("ds_entity_permissions")
        .values({
          id: randomUUID(),
          data_source_id: dataSourceId,
          ds_role_id: dsRoleId,
          entity_name: table,
          entity_type: "table",
          entity_schema: "public",
          // `select` is the vocabulary the type declares and the permissions
          // screen offers, so a seeded row is one an administrator can read and
          // edit in the UI this product already ships. See the note on
          // SELECT_LEVELS in sql-ast-validator.ts for why the enforcement side
          // had to learn it.
          permission_level: "select",
          column_restrictions: null,
          row_filter: null,
          created_by: ownerId,
          created_at: stamp,
          updated_at: stamp,
        })
        .execute();
    }

    seeded++;
  }

  return seeded;
}

// --- Entry point -------------------------------------------------------------

async function main(): Promise<number> {
  if (!existsSync(PACK_PATH)) {
    console.error(`[seed] No reporting pack at ${PACK_PATH}. Nothing to load.`);
    return 1;
  }
  if (!APP_DB_URL) {
    console.error("[seed] APP_DATABASE_URL is unset — the data source has nowhere to point.");
    return 1;
  }

  const pack: ReportingPack = JSON.parse(readFileSync(PACK_PATH, "utf8"));
  log(`pack: ${pack.application.name} (${pack.application.model})`);

  const reportingUrl = process.env.DATABASE_URL;
  if (!reportingUrl) {
    console.error("[seed] DATABASE_URL is unset — no reporting database to seed.");
    return 1;
  }

  await waitFor("reporting database", () => pgReachable(reportingUrl));
  await waitFor("application database", () => pgReachable(APP_DB_URL));
  await waitFor("application schema (bus_ tables)", () => appSchemaReady(APP_DB_URL), 600);

  // Synchronous, and bootstraps the schema plus the administrator on first call.
  const db = getDb() as Db;
  await waitFor("reporting schema", async () => {
    await db.selectFrom("users").select("id").limit(1).execute();
    return true;
  });

  const ownerId = await adminUserId(db);

  const dataSource = await upsertDataSource(db, pack, ownerId);
  log(`data source: ${dataSource.name}`);

  const { schemaInfo } = await introspectAndCacheSchema(dataSource);
  log(`schema cached: ${schemaInfo.tables.length} tables`);

  const queryIds = await upsertQueries(db, pack, dataSource.id, ownerId);
  log(`saved queries: ${queryIds.size}`);

  const reportIds = await upsertReports(db, pack, queryIds, ownerId);
  log(`reports: ${reportIds.size}`);

  const chartIds = await upsertCharts(db, pack, queryIds, ownerId);
  log(`charts: ${chartIds.size}`);

  const widgets = await upsertDashboards(db, pack, chartIds, reportIds, ownerId);
  log(`dashboards: ${pack.dashboards.length} (${widgets} widgets)`);

  const accounts = await upsertAccess(db, pack, dataSource.id, ownerId);
  log(`reporting roles: ${accounts}`);

  log("done");
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("[seed] failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
