import type { FieldMetadata } from "@/hooks/use-entities";
import {
  SYS_COLUMN_FORM_FIELDS,
  SYS_COLUMN_GRID_FIELDS,
  SYS_ELEMENT_FORM_FIELDS,
  SYS_ELEMENT_GRID_FIELDS,
  SYS_FIELD_FORM_FIELDS,
  SYS_FIELD_GRID_FIELDS,
  SYS_REFERENCE_FORM_FIELDS,
  SYS_REFERENCE_GRID_FIELDS,
  SYS_TAB_FORM_FIELDS,
  SYS_TAB_GRID_FIELDS,
  SYS_TABLE_FORM_FIELDS,
  SYS_TABLE_GRID_FIELDS,
  SYS_WINDOW_FORM_FIELDS,
  SYS_WINDOW_GRID_FIELDS,
} from "./ad-field-definitions";

// ============================================================================
// Types
// ============================================================================

export interface ADWindowConfig {
  id: string;
  title: string;
  sidebarLabel: string;
  levels: ADLevel[];
}

export interface ADLevel {
  id: string;
  label: string;
  endpoint: string;
  idField: string;
  nameField: string;
  parentField?: string;
  searchField?: string;
  formFields: FieldMetadata[];
  gridFields: FieldMetadata[];
  childTabs?: ADChildTabConfig[];
  /** Optional: when set, overrides admin-style URL construction.
   *  Detail URL → `${baseRoutePath}/${id}`, List URL → `${baseRoutePath}` */
  baseRoutePath?: string;
}

export interface ADChildTabConfig {
  id: string;
  label: string;
  level: ADLevel;
  badge?: "count";
}

// ---------------------------------------------------------------------------
// Metadata-driven URL construction
// level.id (e.g. 'window', 'tab') is the canonical key — it maps directly to
// the sys_<id> table name in the Application Dictionary.
// ---------------------------------------------------------------------------

export interface ParentContext {
  level: ADLevel;
  id: string;
}

/** /admin/window/$id  or  /admin/window/$wId/tab/$tId  etc.
 *  When level.baseRoutePath is set (e.g. bus entities), uses `${baseRoutePath}/${id}` instead. */
export function buildAdminDetailUrl(
  parentCtx: ParentContext[],
  level: ADLevel,
  id: string
): string {
  if (level.baseRoutePath) return `${level.baseRoutePath}/${id}`;
  const parts = parentCtx.flatMap(({ level: l, id: i }) => [l.id, i]);
  parts.push(level.id, id);
  return "/admin/" + parts.join("/");
}

/** /admin/windows  or  /admin/window/$wId/tabs  etc. */
/** /admin/windows  or  /admin/window/$wId/tabs  etc.
 *  When level.baseRoutePath is set, returns `${baseRoutePath}` (the list route itself). */
export function buildAdminListUrl(parentCtx: ParentContext[], level: ADLevel): string {
  if (level.baseRoutePath) return level.baseRoutePath;
  const parts = parentCtx.flatMap(({ level: l, id: i }) => [l.id, i]);
  parts.push(level.id + "s");
  return "/admin/" + parts.join("/");
}

// ============================================================================
// Level Definitions
// ============================================================================

export const TABLE_LEVEL: ADLevel = {
  id: "table",
  label: "Table",
  endpoint: "/sys/tables",
  idField: "sys_table_id",
  nameField: "name",
  searchField: "name",
  formFields: SYS_TABLE_FORM_FIELDS,
  gridFields: SYS_TABLE_GRID_FIELDS,
};

export const COLUMN_LEVEL: ADLevel = {
  id: "column",
  label: "Column",
  endpoint: "/sys/columns",
  idField: "sys_column_id",
  nameField: "name",
  parentField: "tableId",
  searchField: "name",
  formFields: SYS_COLUMN_FORM_FIELDS,
  gridFields: SYS_COLUMN_GRID_FIELDS,
};

export const WINDOW_LEVEL: ADLevel = {
  id: "window",
  label: "Window",
  endpoint: "/sys/windows",
  idField: "sys_window_id",
  nameField: "name",
  searchField: "name",
  formFields: SYS_WINDOW_FORM_FIELDS,
  gridFields: SYS_WINDOW_GRID_FIELDS,
};

export const TAB_LEVEL: ADLevel = {
  id: "tab",
  label: "Tab",
  endpoint: "/sys/tabs",
  idField: "sys_tab_id",
  nameField: "name",
  parentField: "windowId",
  searchField: "name",
  formFields: SYS_TAB_FORM_FIELDS,
  gridFields: SYS_TAB_GRID_FIELDS,
};

export const FIELD_LEVEL: ADLevel = {
  id: "field",
  label: "Field",
  endpoint: "/sys/fields",
  idField: "sys_field_id",
  nameField: "name",
  parentField: "tabId",
  searchField: "name",
  formFields: SYS_FIELD_FORM_FIELDS,
  gridFields: SYS_FIELD_GRID_FIELDS,
};

export const REFERENCE_LEVEL: ADLevel = {
  id: "reference",
  label: "Reference",
  endpoint: "/sys/references",
  idField: "sys_reference_id",
  nameField: "name",
  searchField: "name",
  formFields: SYS_REFERENCE_FORM_FIELDS,
  gridFields: SYS_REFERENCE_GRID_FIELDS,
};

export const ELEMENT_LEVEL: ADLevel = {
  id: "element",
  label: "Element",
  endpoint: "/sys/elements",
  idField: "sys_element_id",
  nameField: "name",
  searchField: "name",
  formFields: SYS_ELEMENT_FORM_FIELDS,
  gridFields: SYS_ELEMENT_GRID_FIELDS,
};

// ============================================================================
// Wire up child tabs
// ============================================================================

TABLE_LEVEL.childTabs = [{ id: "column", label: "Column", level: COLUMN_LEVEL, badge: "count" }];

WINDOW_LEVEL.childTabs = [{ id: "tab", label: "Tab", level: TAB_LEVEL, badge: "count" }];

TAB_LEVEL.childTabs = [{ id: "field", label: "Field", level: FIELD_LEVEL, badge: "count" }];

// ============================================================================
// Window Configs
// ============================================================================

export const TABLE_AND_COLUMN_CONFIG: ADWindowConfig = {
  id: "table-and-column",
  title: "Table and Column",
  sidebarLabel: "Table and Column",
  levels: [TABLE_LEVEL, COLUMN_LEVEL],
};

export const WINDOW_TAB_FIELD_CONFIG: ADWindowConfig = {
  id: "window-tab-field",
  title: "Window, Tab and Field",
  sidebarLabel: "Window, Tab and Field",
  levels: [WINDOW_LEVEL, TAB_LEVEL, FIELD_LEVEL],
};

export const REFERENCE_CONFIG: ADWindowConfig = {
  id: "reference",
  title: "Reference",
  sidebarLabel: "Reference",
  levels: [REFERENCE_LEVEL],
};

export const ELEMENT_CONFIG: ADWindowConfig = {
  id: "element",
  title: "Element",
  sidebarLabel: "Element",
  levels: [ELEMENT_LEVEL],
};
