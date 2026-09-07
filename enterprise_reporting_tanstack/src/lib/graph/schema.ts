/**
 * Knowledge graph node / edge types.
 *
 * Labels (nodes)
 *   DataSource  — a configured reporting data source
 *   Table       — a database table/view inside a DataSource
 *   Column      — a column inside a Table
 *   Report      — a saved report_definition
 *   Chart       — a chart_definition
 *   Dashboard   — a dashboard_layout
 *
 * Relationship types (edges)
 *   HAS_TABLE        DataSource → Table
 *   HAS_COLUMN       Table → Column
 *   FK_REFERENCES    Column → Column  (foreign key)
 *   APPEARS_IN       Table → Report | Chart | Dashboard
 *   CONTAINS_WIDGET  Dashboard → Report | Chart
 */

export interface DSNode {
  id: string;
  name: string;
  client_type: string;
  database: string;
  host: string;
}

export interface TableNode {
  fqn: string; // "<ds_id>.<table_name>"
  ds_id: string;
  name: string;
  schema_name: string;
  description: string;
  row_count: number;
}

export interface ColumnNode {
  fqn: string; // "<ds_id>.<table>.<column>"
  ds_id: string;
  table_name: string;
  name: string;
  data_type: string;
  nullable: boolean;
  is_pk: boolean;
  is_fk: boolean;
  description: string;
}

export interface ReportNode {
  id: string;
  name: string;
  description: string;
  ds_id: string;
}

export interface ChartNode {
  id: string;
  name: string;
  chart_type: string;
  ds_id: string;
}

export interface DashboardNode {
  id: string;
  name: string;
  description: string;
}
