# Features Guide

Complete feature documentation for the Enterprise Reporting System.

## Authentication & Authorization

### User Management
- **Default Admin**: `admin@admin.com` / `admin` (change immediately)
- **Default Analyst**: `analyst@example.com` / `analyst123`
- **JWT Sessions**: Secure HTTP-only cookies
- **Custom JWT**: Implemented with jose library

### Role-Based Access Control (RBAC)
- **Roles**: Admin, Analyst, Viewer
- **Permission Levels**: `view`, `edit`, `execute`, `admin`
- **Resource Types**: data_source, query, report, chart, dashboard, job, user, role
- **Resource-Level Permissions**: Fine-grained access per resource instance
- **Location**: `src/lib/auth/rbac.ts`, `src/lib/permissions/`

### Permission Matrix

| Role | Data Source | Query | Report | Chart | Dashboard | Admin |
|------|-------------|-------|--------|-------|-----------|-------|
| **Admin** | * (all) | * (all) | * (all) | * (all) | * (all) | * (all) |
| **Analyst** | view, query:* | create, edit, view, execute | create, edit, view, execute, export | create, edit, view, execute | create, edit, view | - |
| **Viewer** | view | view | view, export | view | view | - |

## SQL Editor

### Monaco Editor Features
- **Syntax Highlighting**: Full SQL syntax support
- **Keyboard Shortcuts**:
  - `Cmd/Ctrl + Enter`: Execute query
  - `Shift + Alt + F`: Format SQL
- **Auto-completion**: Table and column suggestions
- **Error Highlighting**: Real-time syntax validation
- **Multiple Data Sources**: Switch between databases
- **Query History**: Track executed queries

### Schema Browser
- **Table Introspection**: Browse tables and columns
- **Column Details**: Type, nullable, default value
- **One-Click Query**: Click table/column to insert into editor
- **Collapsible Panel**: Expand/collapse schema tree

### Query Results
- **Virtual Scrolling**: Efficient rendering for 1000+ rows
- **Pagination**: Server-side with configurable page size
- **Export**: Copy to clipboard, export to CSV/Excel
- **Metrics**: Execution time, row count
- **SQL Types Supported**: SELECT, JOIN, UNION, CTE, subqueries, aggregations, window functions

## Reports

### Report Builder

#### General Settings Tab
- **Name**: Report name (required)
- **Data Source Query**: Select from saved queries
- **Description**: Multi-line text description

#### Columns Configuration Tab
- **Field Selection**: Choose columns from query results
- **Column Properties**:
  - Header: Custom display name
  - Width: Auto or numeric pixels
  - Format: Text, Number, Currency, Percentage, Date, DateTime, Boolean
  - Visible: Toggle column visibility
  - Sortable: Enable/disable sorting
  - Filterable: Enable/disable filtering
- **Column Reordering**: Drag-and-drop to reorder
- **Delete**: Remove columns from report

#### Filter Configuration Tab
- **Filter Logic**: AND / OR operators
- **Filter Operators**:
  - Text: equals, not_equals, contains, starts_with, ends_with, in, not_in
  - Number: equals, greater_than, less_than, between
  - Date: before, after, between
  - Boolean: is_true, is_false
  - Other: is_null, is_not_null
- **Nested Groups**: Complex filter combinations

#### Export Settings Tab
- **CSV Export**: Comma-separated values
- **Excel Export**: Native XLSX with formatting
- **PDF Export**: Landscape PDF with headers and pagination

### Report Viewer
- **Dynamic Filters**: Apply filters at runtime
- **Sorting**: Click column headers to sort
- **Pagination**: Navigate large result sets
- **Export**: Generate CSV, Excel, or PDF files

## Charts

### Chart Builder (Excel-Like)

#### Chart Types
1. **Bar Chart** - Compare values across categories
2. **Line Chart** - Show trends over time
3. **Area Chart** - Show volume over time
4. **Pie Chart** - Show proportions of a whole
5. **Scatter Plot** - Show correlations between variables
6. **Composed Charts** - Multiple chart types combined

#### Configuration Options

**X-Axis (Categories)**
- Field selector for category data
- Custom axis labels
- Supports text, number, and date fields

**Y-Axis (Values/Series)**
- Multiple series support
- Field selector per series
- Custom labels per series
- Color picker per series
- Supports multiple value series

**Optional Grouping**
- Group By: Aggregate data by a field
- Color By: Color-code data points by category

**Appearance Controls**
- Title: Toggle and custom text
- Legend: Toggle and position (top/bottom/left/right)
- Tooltip: Enable/disable hover information
- Animation: Toggle chart animations
- Color Scheme: 5-color palette for series

**Live Preview**
- Real-time chart rendering
- Updates as you configure
- Sample data table (first 5 rows)

### Chart Viewer
- **Interactive Tooltips**: Hover for details
- **Legend**: Toggle series visibility
- **Zoom**: Data zoom for time series
- **Export**: Download as PNG

## Dashboards

### Dashboard Builder
- **Drag-and-Drop Layout**: react-grid-layout
- **Widget Types**: Charts, Tables, Metrics
- **Responsive Grid**: Auto-resize on window resize
- **Public/Private**: Control dashboard visibility

### Widget Configuration
- **Chart Widgets**: Link to saved charts
- **Table Widgets**: Link to saved queries
- **Metric Widgets**: Show single values (SUM, AVG, COUNT, MIN, MAX)
- **Widget Sizing**: Width (columns), height (rows)

### Dashboard Viewer
- **Collapsible Widgets**: Minimize widgets
- **Edit Mode**: Rearrange and configure widgets
- **Refresh**: Auto-refresh with configurable intervals

## Data Sources

### Supported Databases
- **SQLite**: via better-sqlite3
- **PostgreSQL**: via pg
- **MySQL**: via mysql2
- **MSSQL**: via mssql
- **Oracle**: via oracledb

### Connection Management
- **Secure Storage**: AES-256-GCM encryption for credentials
- **Connection Testing**: Verify connection before saving
- **Active/Inactive**: Enable/disable without deleting
- **Schema Introspection**: Browse tables and columns

### Permissions
- **Entity-Level Access Control**: Grant permissions per table/view
- **Role-Based**: Assign access to roles
- **CRUD Control**: View, Insert, Update, Delete permissions per entity

## Saved Queries

### Features
- **SQL Templates**: Save reusable SQL queries
- **Parameterized**: Support for query parameters
- **Organization**: Group by category
- **Version History**: Track query changes
- **Quick Access**: One-click execution from editor

## Filters

### Reusable Filters
- **Filter Builder**: Visual filter configuration
- **Save & Reuse**: Save filter configurations
- **Share**: Share filters with other users
- **Apply to Reports**: Link filters to reports

## Export & Reporting

### Export Formats
- **CSV**: Standard comma-separated values
- **Excel**: XLSX with formatting and formulas
- **PDF**: Landscape PDF with headers and pagination

### Background Jobs
- **BullMQ Queue**: Job processing with Redis
- **Job Status**: Track job progress
- **Download Results**: Download generated files
- **Email Reports**: Send reports via email (Nodemailer)
- **Scheduled Exports**: Automate report generation

## Natural Language Query

### AI-Powered SQL
- **CopilotKit Integration**: AI assistant for query building
- **OpenAI GPT**: Generate SQL from natural language
- **Query History**: Track NL queries and results
- **Schema Awareness**: Understands database schema

## Metadata Management

### Entity Metadata
- **Custom Descriptions**: Add descriptions to tables and columns
- **Business Names**: User-friendly names for technical columns
- **Data Types**: View and edit column types
- **Relationships**: Define table relationships
- **Sync**: Keep metadata in sync with source database

## Administration

### User Management
- **CRUD Operations**: Create, read, update, delete users
- **Role Assignment**: Assign multiple roles to users
- **Password Reset**: Reset user passwords
- **Activity Log**: Track user activity

### Role Management
- **Custom Roles**: Create new roles
- **Permission Matrix**: Grant permissions to roles
- **Role Hierarchy**: Define role inheritance
- **Audit Trail**: Track role changes

### Permission Management
- **Resource Permissions**: Grant access to specific resources
- **Bulk Operations**: Grant permissions in bulk
- **Access Control UI**: Visual permission matrix

## System Features

### Health Monitoring
- **Health Check Endpoint**: `GET /api/health`
- **Database Status**: Check database connectivity
- **Job Queue Status**: Monitor BullMQ queue
- **Audit Logs**: View system audit trail

### Configuration
- **Environment Variables**: Configure via .env
- **Pagination**: Configure page sizes
- **Job Processing**: Configure concurrent jobs
- **Email**: Configure SMTP settings
- **Error Reporting**: Configure error email recipients

### Security
- **Encryption**: AES-256-GCM for sensitive data
- **Audit Logging**: All sensitive actions logged
- **SQL Injection Prevention**: Parameterized queries
- **XSS Prevention**: Input sanitization
- **CSRF Protection**: SameSite cookie policy with HTTP-only flags

## Quick Reference

### Default Credentials
- **Admin**: `admin@admin.com` / `admin`
- **Analyst**: `analyst@example.com` / `analyst123`

### URLs (Development)
- **App**: http://localhost:4050
- **Login**: http://localhost:4050/login
- **SQL Editor**: http://localhost:4050/sql-editor
- **Reports**: http://localhost:4050/reports
- **Charts**: http://localhost:4050/charts
- **Dashboards**: http://localhost:4050/dashboards

### Database
- **Config DB**: `data/config.sqlite`
- **Sakila Demo**: `data/uploads/sakila.db`

### Key Files
- **Chart Builder**: `src/app/(dashboard)/charts/editor/[id]/page.tsx`
- **Report Editor**: `src/app/(dashboard)/reports/editor/[id]/page.tsx`
- **SQL Editor**: `src/app/(dashboard)/sql-editor/page.tsx`
- **Dashboard Grid**: `src/components/dashboard/dashboard-grid.tsx`
- **Data Table**: `src/components/reporting/data-table.tsx`
- **Chart Renderer**: `src/components/charts/chart-renderer.tsx`
