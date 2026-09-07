# Chart Builder Feature Documentation

## Overview
A rich, Excel-like chart builder that allows users to create interactive data visualizations from SQL queries with complete control over axes, series, and appearance.

## Features Implemented

### 1. Chart Data API Endpoint
**File:** `src/app/api/charts/[id]/data/route.ts`

- Fetches chart definition and associated query
- Executes SQL query securely with read-only validation
- Returns query results for chart rendering
- Includes execution time tracking
- Proper error handling and authentication

### 2. Excel-Like Chart Builder
**File:** `src/app/(dashboard)/charts/editor/[id]/page.tsx`

#### Data Source Configuration
- **Query Selector**: Dropdown to choose from saved queries
- **Field Discovery**: Automatically shows available fields from query results
- **Real-time Data Preview**: Shows sample data from selected query

#### Axis Configuration

**X-Axis (Categories)**
- Field selector for category data
- Custom axis labels
- Supports text, number, and date fields

**Y-Axis (Values/Series)**
- Multiple series support (add/remove dynamically)
- Field selector for each series
- Custom labels for each series
- Color picker for each series
- Supports multiple value series (e.g., Revenue & Profit)

**Optional Grouping**
- **Group By**: Aggregate data by a field
- **Color By**: Color-code data points by category

#### Chart Types
5 built-in chart types with visual selection:
1. **Bar Chart** - Compare values across categories
2. **Line Chart** - Show trends over time
3. **Area Chart** - Show volume over time
4. **Pie Chart** - Show proportions of a whole
5. **Scatter Plot** - Show correlation between two variables

#### Appearance Controls
- **Title**: Toggle visibility, custom text
- **Legend**: Toggle visibility, position (top/bottom/left/right)
- **Tooltip**: Enable/disable hover information
- **Animation**: Toggle chart animations
- **Color Scheme**: 5-color palette for series

#### Real-Time Preview
- **Live Chart Preview**: See changes instantly as you configure
- **Sample Data Table**: View first 5 rows of query results
- **Responsive**: Works on different screen sizes
- **Toggle Preview**: Show/hide preview panel

### 3. Enhanced Charts List Page
**File:** `src/app/(dashboard)/charts/page.tsx`

**Updated Features:**
- **"Open Chart Editor"** button - Goes directly to full-featured editor
- **"Quick Create"** button - Fast creation with minimal dialog
- Auto-redirect to editor after creation
- Edit links in dropdown menu point to new editor

## How It Works

### Chart Creation Flow

```
1. User clicks "Open Chart Editor"
   ↓
2. Editor loads with "new" chart ID
   ↓
3. User configures:
   - Chart name & description
   - Selects SQL query from dropdown
   - System shows available fields from query
   - User selects X-axis field (e.g., "month")
   - User adds Y-axis series (e.g., "revenue", "profit")
   - User chooses chart type (e.g., "bar")
   ↓
4. Live preview updates automatically
   ↓
5. User clicks "Save Chart"
   ↓
6. Chart saved to database with full configuration
   ↓
7. User can view chart or add to dashboard
```

### Data Mapping Structure

```typescript
{
  xAxis: {
    field: "month",           // Database column for X-axis
    label: "Month"            // Display label
  },
  yAxis: [
    {
      field: "revenue",       // Database column for values
      label: "Revenue",       // Series display label
      color: "#3b82f6"        // Series color
    },
    {
      field: "profit",
      label: "Profit",
      color: "#10b981"
    }
  ],
  groupBy: "region",          // Optional: grouping field
  colorBy: "category"         // Optional: color-coding field
}
```

### Chart Configuration Structure

```typescript
{
  title: {
    show: true,
    text: "Monthly Sales Performance"
  },
  legend: {
    show: true,
    position: "bottom"        // top|bottom|left|right
  },
  tooltip: {
    enabled: true
  },
  animation: true,
  colors: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]
}
```

## SQL Query Examples for Charts

### 1. Time Series Data (Line/Area Chart)
```sql
SELECT
  strftime('%Y-%m', order_date) as month,
  SUM(amount) as revenue,
  COUNT(*) as orders
FROM orders
GROUP BY month
ORDER BY month;
```
**X-Axis:** month
**Y-Axis:** revenue, orders

### 2. Category Comparison (Bar Chart)
```sql
SELECT
  category,
  SUM(quantity) as total_sold,
  AVG(price) as avg_price
FROM products
GROUP BY category
ORDER BY total_sold DESC;
```
**X-Axis:** category
**Y-Axis:** total_sold, avg_price

### 3. Proportions (Pie Chart)
```sql
SELECT
  status,
  COUNT(*) as count
FROM orders
GROUP BY status;
```
**X-Axis:** status
**Y-Axis:** count

### 4. Multi-Series with Grouping (Grouped Bar Chart)
```sql
SELECT
  region,
  product_category,
  SUM(revenue) as total_revenue
FROM sales
GROUP BY region, product_category
ORDER BY region, total_revenue DESC;
```
**X-Axis:** product_category
**Y-Axis:** total_revenue
**Group By:** region
**Color By:** region

## Example Use Cases

### Sales Dashboard
```typescript
// Query: Monthly sales by region
SELECT
  strftime('%Y-%m', order_date) as month,
  region,
  SUM(amount) as revenue
FROM orders
GROUP BY month, region;

// Chart Configuration
X-Axis: month
Y-Axis: revenue (multiple series)
Group By: region
Color By: region
Chart Type: Line or Bar
```

### Product Analysis
```typescript
// Query: Product performance
SELECT
  p.category,
  p.name,
  SUM(oi.quantity) as sold,
  SUM(oi.quantity * oi.price) as revenue
FROM order_items oi
JOIN products p ON oi.product_id = p.id
GROUP BY p.category, p.name
ORDER BY revenue DESC;

// Chart Configuration
X-Axis: name
Y-Axis: revenue, sold
Group By: category
Chart Type: Bar
```

### Customer Distribution
```typescript
// Query: Customers by country
SELECT
  country,
  COUNT(*) as customer_count
FROM customers
GROUP BY country
ORDER BY customer_count DESC
LIMIT 10;

// Chart Configuration
X-Axis: country
Y-Axis: customer_count
Chart Type: Pie or Horizontal Bar
```

## File Structure

```
src/
├── app/
│   ├── api/
│   │   └── charts/
│   │       ├── [id]/
│   │       │   └── data/
│   │       │       └── route.ts          # Chart data API endpoint
│   │       ├── route.ts                   # Chart CRUD operations
│   │       └── [id]/route.ts             # Individual chart operations
│   └── (dashboard)/
│       └── charts/
│           ├── page.tsx                   # Charts list (updated)
│           ├── editor/
│           │   └── [id]/
│           │       └── page.tsx           # Chart builder (NEW)
│           └── viewer/
│               └── [id]/
│                   └── page.tsx           # Chart viewer
└── components/
    └── charts/
        └── chart-renderer.tsx            # Chart rendering component
```

## Component Features

### 1. Query Selector
- Dropdown with query names and descriptions
- Shows query metadata (description, data source)
- Automatically loads query results on selection
- Displays available fields

### 2. Field Mapping
- Dynamic field population from query results
- Type-aware field suggestions
- Support for nested/aggregated fields
- Field metadata display

### 3. Axis Builder
- Visual axis configuration
- Drag-and-drop reordering (planned)
- Multiple series management
- Add/remove series dynamically
- Color picker per series

### 4. Chart Type Selector
- Visual icons for each chart type
- Descriptions of when to use each type
- Large, clickable buttons
- Visual selection state

### 5. Preview Panel
- Real-time chart rendering
- Live updates on configuration change
- Sample data table
- Toggle visibility
- Sticky positioning while scrolling

### 6. Save/Load
- Create new charts
- Update existing charts
- Auto-save indication (planned)
- Save confirmation
- Redirect after save

## API Endpoints

### GET `/api/charts/[id]/data`
Fetches chart data from associated query.

**Response:**
```json
{
  "success": true,
  "data": {
    "rows": [
      { "month": "2024-01", "revenue": 15000, "orders": 45 },
      { "month": "2024-02", "revenue": 18000, "orders": 52 }
    ],
    "meta": {
      "queryId": "abc-123",
      "queryName": "Monthly Sales",
      "executionTime": 45
    }
  }
}
```

### POST `/api/charts`
Creates a new chart definition.

**Request Body:**
```json
{
  "name": "Monthly Revenue",
  "description": "Revenue trends by month",
  "chartType": "line",
  "savedQueryId": "query-123",
  "chartConfig": "{ ... }",
  "dataMapping": "{ ... }"
}
```

### PUT `/api/charts/[id]`
Updates an existing chart.

## Usage Instructions

### Creating a New Chart

1. Navigate to `/charts`
2. Click "Open Chart Editor" button
3. Fill in basic information:
   - Name: "Monthly Sales by Region"
   - Description: "Sales breakdown by region and month"
4. Select data source query from dropdown
5. Configure axes:
   - X-Axis: Select "month" field
   - Y-Axis: Add series for "revenue" and "orders"
6. Optional: Select "region" for Group By to create multiple series
7. Choose chart type (e.g., Line Chart)
8. Adjust appearance (title, legend, colors)
9. Preview updates automatically
10. Click "Save Chart"

### Editing an Existing Chart

1. Navigate to `/charts`
2. Find chart in list
3. Click "Edit" in dropdown menu
4. Make changes in editor
5. Preview updates live
6. Click "Save Chart"

## Best Practices

### SQL Queries for Charts
- **Aggregate data**: Use GROUP BY for category charts
- **Time series**: Format dates with strftime() or DATE_TRUNC()
- **Ordering**: Always include ORDER BY for consistent results
- **Limit**: Use LIMIT for pie/top-N charts
- **Aliases**: Use AS for readable column names
- **No wildcards**: Explicitly SELECT only needed columns

### Chart Selection Guide

| Use Case | Best Chart Type |
|----------|----------------|
| Comparing categories | Bar Chart |
| Time trends | Line Chart |
| Volume over time | Area Chart |
| Parts of whole | Pie Chart |
| Correlations | Scatter Plot |
| Multiple metrics | Grouped Bar Chart |

### Performance Tips
- Limit query results for charts (500-1000 rows max)
- Use database indexes on GROUP BY columns
- Pre-aggregate in complex cases
- Use pagination for large datasets
- Cache chart results (planned feature)

## Future Enhancements

### Phase 2 Features
- Custom color palettes
- Axis formatting (currency, percentages, dates)
- Stacked bar charts
- Dual Y-axis charts
- Drill-down functionality
- Chart export (PNG, SVG)
- Chart templates
- Favorite charts
- Dashboard embedding

### Phase 3 Features
- Calculated fields
- Filter controls in viewer
- Real-time data refresh
- Annotations and markers
- Trend lines
- Forecasting
- Combo charts (bar + line)

## Technical Details

### Dependencies
- **Recharts 2.12.7** - Chart rendering library
- **React Query** - Data fetching and caching
- **Lucide React** - Icons
- **Tailwind CSS** - Styling
- **Kysely** - Database queries (via saved queries)

### Security
- All queries validated as read-only
- Authentication required for all operations
- SQL injection protection via parameterized queries
- Query access control via data source permissions

### Performance
- Chart data API validates read-only queries
- Query execution time tracking
- Result size limits (enforced)
- Efficient data transfer (JSON)

## Troubleshooting

### Chart Not Displaying
1. Check query returns data
2. Verify X and Y axes are configured
3. Ensure field names match exactly
4. Check browser console for errors
5. Verify query is read-only

### Preview Not Updating
1. Check browser console for errors
2. Verify query selected
3. Ensure both axes configured
4. Try toggling preview off/on

### Save Fails
1. Check all required fields filled
2. Verify chart name is unique
3. Check network tab in devtools
4. Ensure authenticated

### Wrong Data Displayed
1. Verify field mapping is correct
2. Check query SQL returns expected data
3. Review data types (strings vs numbers)
4. Confirm chart type matches data

## Related Files
- `src/components/charts/chart-renderer.tsx` - Chart rendering component
- `src/types/database.ts` - TypeScript type definitions
- `src/lib/db/seeds/` - Sample data for testing
- `e2e/charts-comprehensive.spec.ts` - E2E tests

## Support
For issues or questions:
1. Check browser console for errors
2. Review server logs
3. Verify query executes in SQL Editor
4. Check chart configuration JSON
5. Test with sample data first
