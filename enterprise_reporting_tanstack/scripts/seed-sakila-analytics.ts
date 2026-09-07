/**
 * Seed script for Sakila Analytics
 * Creates professional saved queries, reports, charts, and dashboards
 */

import { getDb } from '../src/lib/db/config';
import { v4 as uuidv4 } from 'uuid';
import { encrypt } from '../src/lib/security/encryption';

const DATA_SOURCE_ID = '30441bec-c1f0-4807-a9ae-f201502913d2'; // Sakila Demo DB
// Will get a valid user ID from the database
let SYSTEM_USER_ID = '1cede1d1-1897-4203-aa44-292a7f7834f2'; // Default admin

const queries = [
  // REVENUE ANALYTICS
  {
    name: 'Monthly Revenue Trend',
    description: 'Track revenue, rentals, and customers by month',
    category: 'Revenue',
    sql: `SELECT
  strftime('%Y-%m', rental_date) as month,
  ROUND(SUM(p.amount), 2) as total_revenue,
  COUNT(DISTINCT r.rental_id) as rental_count,
  COUNT(DISTINCT p.customer_id) as unique_customers,
  ROUND(AVG(p.amount), 2) as avg_payment_amount
FROM rental r
JOIN payment p ON r.rental_id = p.rental_id
GROUP BY strftime('%Y-%m', rental_date)
ORDER BY month DESC`,
  },
  {
    name: 'Revenue by Store',
    description: 'Compare revenue performance across stores',
    category: 'Revenue',
    sql: `SELECT
  s.store_id,
  s.manager_staff_id,
  ROUND(SUM(p.amount), 2) as total_revenue,
  COUNT(DISTINCT r.rental_id) as rental_count,
  COUNT(DISTINCT p.customer_id) as unique_customers,
  ROUND(AVG(p.amount), 2) as avg_payment_amount
FROM store s
JOIN staff st ON s.manager_staff_id = st.staff_id
JOIN rental r ON st.staff_id = r.staff_id
JOIN payment p ON r.rental_id = p.rental_id
GROUP BY s.store_id, s.manager_staff_id
ORDER BY total_revenue DESC`,
  },
  {
    name: 'Revenue by Film Category',
    description: 'Analyze revenue by film category',
    category: 'Revenue',
    sql: `SELECT
  c.name as category,
  ROUND(SUM(p.amount), 2) as total_revenue,
  COUNT(DISTINCT r.rental_id) as rental_count,
  ROUND(AVG(p.amount), 2) as avg_revenue_per_rental
FROM category c
JOIN film_category fc ON c.category_id = fc.category_id
JOIN film f ON fc.film_id = f.film_id
JOIN inventory i ON f.film_id = i.film_id
JOIN rental r ON i.inventory_id = r.inventory_id
JOIN payment p ON r.rental_id = p.rental_id
GROUP BY c.category_id, c.name
ORDER BY total_revenue DESC`,
  },
  {
    name: 'Top 10 Performing Films',
    description: 'Best performing films by revenue',
    category: 'Revenue',
    sql: `SELECT
  f.title,
  f.rental_rate,
  COUNT(DISTINCT r.rental_id) as rental_count,
  ROUND(SUM(p.amount), 2) as total_revenue,
  ROUND(SUM(p.amount) / COUNT(DISTINCT r.rental_id), 2) as avg_revenue_per_rental,
  c.name as category
FROM film f
JOIN film_category fc ON f.film_id = fc.film_id
JOIN category c ON fc.category_id = c.category_id
JOIN inventory i ON f.film_id = i.film_id
JOIN rental r ON i.inventory_id = r.inventory_id
JOIN payment p ON r.rental_id = p.rental_id
GROUP BY f.film_id, f.title, f.rental_rate, c.name
ORDER BY total_revenue DESC
LIMIT 10`,
  },
  {
    name: 'Daily Revenue Trend',
    description: 'Daily revenue for the last 30 days',
    category: 'Revenue',
    sql: `SELECT
  DATE(r.rental_date) as rental_date,
  ROUND(SUM(p.amount), 2) as daily_revenue,
  COUNT(DISTINCT r.rental_id) as daily_rentals,
  COUNT(DISTINCT p.customer_id) as daily_customers
FROM rental r
JOIN payment p ON r.rental_id = p.rental_id
WHERE r.rental_date >= DATE('now', '-30 days')
GROUP BY DATE(r.rental_date)
ORDER BY rental_date DESC`,
  },

  // CUSTOMER ANALYTICS
  {
    name: 'Top Customers by Spending',
    description: 'Identify most valuable customers',
    category: 'Customer',
    sql: `SELECT
  c.customer_id,
  c.first_name || ' ' || c.last_name as customer_name,
  c.email,
  ROUND(SUM(p.amount), 2) as total_spent,
  COUNT(DISTINCT r.rental_id) as rental_count,
  ROUND(SUM(p.amount) / COUNT(DISTINCT r.rental_id), 2) as avg_spent_per_rental,
  MIN(r.rental_date) as first_rental,
  MAX(r.rental_date) as last_rental
FROM customer c
JOIN rental r ON c.customer_id = r.customer_id
JOIN payment p ON r.rental_id = p.rental_id
GROUP BY c.customer_id, c.first_name, c.last_name, c.email
ORDER BY total_spent DESC
LIMIT 20`,
  },
  {
    name: 'Customer Rental Frequency',
    description: 'Distribution of rental frequency',
    category: 'Customer',
    sql: `SELECT
  rental_count,
  COUNT(*) as customer_count
FROM (
  SELECT
    customer_id,
    COUNT(rental_id) as rental_count
  FROM rental
  GROUP BY customer_id
) rental_counts
GROUP BY rental_count
ORDER BY rental_count DESC`,
  },
  {
    name: 'New Customer Acquisition',
    description: 'Track new customers over time',
    category: 'Customer',
    sql: `SELECT
  strftime('%Y-%m', c.create_date) as month,
  COUNT(*) as new_customers
FROM customer c
GROUP BY strftime('%Y-%m', c.create_date)
ORDER BY month DESC`,
  },

  // INVENTORY ANALYTICS
  {
    name: 'Film Category Distribution',
    description: 'Number of films per category',
    category: 'Inventory',
    sql: `SELECT
  c.name as category,
  COUNT(DISTINCT f.film_id) as film_count
FROM category c
JOIN film_category fc ON c.category_id = fc.category_id
JOIN film f ON fc.film_id = f.film_id
GROUP BY c.category_id, c.name
ORDER BY film_count DESC`,
  },
  {
    name: 'Most Rented Films',
    description: 'Top 20 most rented films',
    category: 'Inventory',
    sql: `SELECT
  f.title,
  f.rental_rate,
  COUNT(DISTINCT r.rental_id) as rental_count,
  c.name as category,
  f.rating
FROM film f
JOIN film_category fc ON f.film_id = fc.film_id
JOIN category c ON fc.category_id = c.category_id
JOIN inventory i ON f.film_id = i.film_id
LEFT JOIN rental r ON i.inventory_id = r.inventory_id
GROUP BY f.film_id, f.title, f.rental_rate, c.name, f.rating
ORDER BY rental_count DESC
LIMIT 20`,
  },
  {
    name: 'Inventory Utilization',
    description: 'Track inventory utilization by category',
    category: 'Inventory',
    sql: `SELECT
  c.name as category,
  COUNT(DISTINCT i.inventory_id) as total_inventory,
  COUNT(DISTINCT CASE WHEN r.rental_id IS NOT NULL THEN i.inventory_id END) as ever_rented,
  ROUND(COUNT(DISTINCT CASE WHEN r.rental_id IS NOT NULL THEN i.inventory_id END) * 100.0 / COUNT(DISTINCT i.inventory_id), 2) as utilization_rate
FROM category c
JOIN film_category fc ON c.category_id = fc.category_id
JOIN film f ON fc.film_id = f.film_id
JOIN inventory i ON f.film_id = i.film_id
LEFT JOIN rental r ON i.inventory_id = r.inventory_id
GROUP BY c.category_id, c.name
ORDER BY utilization_rate DESC`,
  },

  // RENTAL ANALYTICS
  {
    name: 'Rental Duration Stats',
    description: 'Distribution of rental durations',
    category: 'Rental',
    sql: `SELECT
  ROUND(JULIANDATE(return_date) - JULIANDATE(rental_date), 1) as rental_days,
  COUNT(*) as rental_count
FROM rental
WHERE return_date IS NOT NULL
GROUP BY ROUND(JULIANDATE(return_date) - JULIANDATE(rental_date), 1)
ORDER BY rental_days`,
  },
  {
    name: 'Returns by Day of Week',
    description: 'Rental returns by day of week',
    category: 'Rental',
    sql: `SELECT
  CASE strftime('%w', return_date)
    WHEN '0' THEN 'Sunday'
    WHEN '1' THEN 'Monday'
    WHEN '2' THEN 'Tuesday'
    WHEN '3' THEN 'Wednesday'
    WHEN '4' THEN 'Thursday'
    WHEN '5' THEN 'Friday'
    WHEN '6' THEN 'Saturday'
  END as day_name,
  COUNT(*) as return_count
FROM rental
WHERE return_date IS NOT NULL
GROUP BY day_name
ORDER BY CASE strftime('%w', return_date)
    WHEN '0' THEN 0
    WHEN '1' THEN 1
    WHEN '2' THEN 2
    WHEN '3' THEN 3
    WHEN '4' THEN 4
    WHEN '5' THEN 5
    WHEN '6' THEN 6
END`,
  },

  // STAFF PERFORMANCE
  {
    name: 'Staff Performance',
    description: 'Performance metrics by staff member',
    category: 'Staff',
    sql: `SELECT
  s.staff_id,
  s.first_name || ' ' || s.last_name as staff_name,
  COUNT(DISTINCT r.rental_id) as rentals_processed,
  ROUND(SUM(p.amount), 2) as total_revenue,
  ROUND(AVG(p.amount), 2) as avg_transaction,
  COUNT(DISTINCT p.customer_id) as unique_customers_served
FROM staff s
LEFT JOIN rental r ON s.staff_id = r.staff_id
LEFT JOIN payment p ON r.rental_id = p.rental_id
GROUP BY s.staff_id, s.first_name, s.last_name
ORDER BY total_revenue DESC`,
  },

  // STORE COMPARISON
  {
    name: 'Store Comparison',
    description: 'Compare stores across key metrics',
    category: 'Operations',
    sql: `SELECT
  'Store ' || s.store_id as store_name,
  (SELECT COUNT(*) FROM customer WHERE store_id = s.store_id) as customer_count,
  (SELECT COUNT(*) FROM inventory i JOIN store st ON i.store_id = st.store_id WHERE st.store_id = s.store_id) as inventory_count,
  COUNT(DISTINCT r.rental_id) as rental_count,
  ROUND(SUM(p.amount), 2) as total_revenue
FROM store s
LEFT JOIN staff st ON s.manager_staff_id = st.staff_id
LEFT JOIN rental r ON st.staff_id = r.staff_id
LEFT JOIN payment p ON r.rental_id = p.rental_id
GROUP BY s.store_id
ORDER BY total_revenue DESC`,
  },
];

// Map query names to IDs after insertion
const queryIdMap: Record<string, string> = {};

async function seedQueries() {
  // biome-ignore lint/suspicious/noExplicitAny: seed script uses dynamic table inserts
  const db = getDb() as any;

  console.log('📊 Creating saved queries...');

  for (const query of queries) {
    const id = uuidv4();

    await db.insertInto('saved_queries').values({
      id,
      name: query.name,
      description: query.description,
      data_source_id: DATA_SOURCE_ID,
      sql_content: query.sql,
      created_by: SYSTEM_USER_ID,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).execute();

    queryIdMap[query.name] = id;
    console.log(`  ✓ Created query: ${query.name}`);
  }

  console.log(`\n✅ Created ${queries.length} saved queries\n`);
  return queryIdMap;
}

async function seedReports(queryIds: Record<string, string>) {
  // biome-ignore lint/suspicious/noExplicitAny: seed script uses dynamic table inserts
  const db = getDb() as any;

  console.log('📄 Creating reports...');

  const reports = [
    {
      name: 'Monthly Revenue Report',
      description: 'Comprehensive monthly revenue analysis',
      query_name: 'Monthly Revenue Trend',
      column_config: JSON.stringify([
        { key: 'month', label: 'Month', width: 120 },
        { key: 'total_revenue', label: 'Revenue', width: 120 },
        { key: 'rental_count', label: 'Rentals', width: 100 },
        { key: 'unique_customers', label: 'Customers', width: 100 },
        { key: 'avg_payment_amount', label: 'Avg Payment', width: 120 },
      ]),
    },
    {
      name: 'Store Performance Report',
      description: 'Compare store performance metrics',
      query_name: 'Revenue by Store',
      column_config: JSON.stringify([
        { key: 'store_id', label: 'Store', width: 80 },
        { key: 'total_revenue', label: 'Revenue', width: 120 },
        { key: 'rental_count', label: 'Rentals', width: 100 },
        { key: 'unique_customers', label: 'Customers', width: 100 },
        { key: 'avg_payment_amount', label: 'Avg Payment', width: 120 },
      ]),
    },
    {
      name: 'Top Customers Report',
      description: 'Most valuable customers list',
      query_name: 'Top Customers by Spending',
      column_config: JSON.stringify([
        { key: 'customer_name', label: 'Customer', width: 200 },
        { key: 'email', label: 'Email', width: 250 },
        { key: 'total_spent', label: 'Total Spent', width: 120 },
        { key: 'rental_count', label: 'Rentals', width: 100 },
        { key: 'avg_spent_per_rental', label: 'Avg per Rental', width: 130 },
      ]),
    },
    {
      name: 'Inventory Utilization Report',
      description: 'Track inventory efficiency',
      query_name: 'Inventory Utilization',
      column_config: JSON.stringify([
        { key: 'category', label: 'Category', width: 150 },
        { key: 'total_inventory', label: 'Total Inventory', width: 130 },
        { key: 'ever_rented', label: 'Ever Rented', width: 120 },
        { key: 'utilization_rate', label: 'Utilization %', width: 120 },
      ]),
    },
  ];

  for (const report of reports) {
    const id = uuidv4();
    const queryId = queryIds[report.query_name];

    await db.insertInto('report_definitions').values({
      id,
      name: report.name,
      description: report.description,
      saved_query_id: queryId,
      column_config: report.column_config,
      created_by: SYSTEM_USER_ID,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).execute();

    console.log(`  ✓ Created report: ${report.name}`);
  }

  console.log(`\n✅ Created ${reports.length} reports\n`);
}

async function seedCharts(queryIds: Record<string, string>) {
  // biome-ignore lint/suspicious/noExplicitAny: seed script uses dynamic table inserts
  const db = getDb() as any;

  console.log('📈 Creating charts...');

  const charts = [
    {
      name: 'Revenue Over Time',
      description: 'Monthly revenue trend line chart',
      query_name: 'Monthly Revenue Trend',
      chart_type: 'line',
      config: {
        xAxis: 'month',
        yAxis: ['total_revenue', 'rental_count'],
        chartType: 'line',
        title: 'Revenue Trend',
        height: 300,
      },
    },
    {
      name: 'Revenue by Category',
      description: 'Bar chart of revenue by film category',
      query_name: 'Revenue by Film Category',
      chart_type: 'bar',
      config: {
        xAxis: 'category',
        yAxis: ['total_revenue'],
        chartType: 'bar',
        title: 'Revenue by Category',
        height: 300,
      },
    },
    {
      name: 'Top Films',
      description: 'Horizontal bar chart of top films',
      query_name: 'Top 10 Performing Films',
      chart_type: 'bar',
      config: {
        xAxis: 'title',
        yAxis: ['total_revenue'],
        chartType: 'horizontal-bar',
        title: 'Top 10 Films by Revenue',
        height: 400,
      },
    },
    {
      name: 'Customer Spending',
      description: 'Bar chart of top customer spending',
      query_name: 'Top Customers by Spending',
      chart_type: 'bar',
      config: {
        xAxis: 'customer_name',
        yAxis: ['total_spent'],
        chartType: 'bar',
        title: 'Top 20 Customers by Spending',
        height: 400,
      },
    },
    {
      name: 'Store Comparison',
      description: 'Compare stores across metrics',
      query_name: 'Store Comparison',
      chart_type: 'bar',
      config: {
        xAxis: 'store_name',
        yAxis: ['customer_count', 'rental_count', 'total_revenue'],
        chartType: 'grouped-bar',
        title: 'Store Performance Comparison',
        height: 350,
      },
    },
    {
      name: 'Inventory Utilization',
      description: 'Utilization rate by category',
      query_name: 'Inventory Utilization',
      chart_type: 'pie',
      config: {
        xAxis: 'category',
        yAxis: ['utilization_rate'],
        chartType: 'pie',
        title: 'Inventory Utilization by Category',
        height: 350,
      },
    },
    {
      name: 'Returns by Day',
      description: 'Returns distribution by weekday',
      query_name: 'Returns by Day of Week',
      chart_type: 'bar',
      config: {
        xAxis: 'day_name',
        yAxis: ['return_count'],
        chartType: 'bar',
        title: 'Rental Returns by Day of Week',
        height: 300,
      },
    },
    {
      name: 'Staff Performance',
      description: 'Performance comparison by staff',
      query_name: 'Staff Performance',
      chart_type: 'bar',
      config: {
        xAxis: 'staff_name',
        yAxis: ['total_revenue', 'rentals_processed'],
        chartType: 'grouped-bar',
        title: 'Staff Performance Metrics',
        height: 350,
      },
    },
  ];

  for (const chart of charts) {
    const id = uuidv4();
    const queryId = queryIds[chart.query_name];

    await db.insertInto('chart_definitions').values({
      id,
      name: chart.name,
      description: chart.description,
      saved_query_id: queryId,
      chart_type: chart.chart_type,
      chart_config: JSON.stringify(chart.config),
      data_mapping: JSON.stringify({
        xAxis: chart.config.xAxis,
        yAxis: chart.config.yAxis,
      }),
      created_by: SYSTEM_USER_ID,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).execute();

    console.log(`  ✓ Created chart: ${chart.name}`);
  }

  console.log(`\n✅ Created ${charts.length} charts\n`);
}

async function seedDashboards(queryIds: Record<string, string>) {
  // biome-ignore lint/suspicious/noExplicitAny: seed script uses dynamic table inserts
  const db = getDb() as any;

  console.log('🎛️  Creating dashboards...');

  // First create the dashboard layout
  const dashboardId = uuidv4();

  await db.insertInto('dashboard_layouts').values({
    id: dashboardId,
    name: 'Sakila Analytics Dashboard',
    description: 'Complete business analytics for Sakila DVD rental store',
    layout_config: JSON.stringify({ rows: 'auto-fit', cols: 8, gap: 16 }),
    theme_config: '{}',
    is_public: true,
    created_by: SYSTEM_USER_ID,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).execute();

  console.log(`  ✓ Created dashboard layout: Sakila Analytics Dashboard`);

  // Get chart IDs
  const charts = await db.selectFrom('chart_definitions')
    .select(['id', 'name'])
    .where('name', 'in', [
      'Revenue Over Time',
      'Revenue by Category',
      'Store Comparison',
      'Top Films',
      'Inventory Utilization',
    ])
    .execute();

  // Create widgets for the dashboard
  const widgets = [
    { chart_name: 'Revenue Over Time', position: { x: 0, y: 0, w: 4, h: 2 } },
    { chart_name: 'Revenue by Category', position: { x: 4, y: 0, w: 4, h: 2 } },
    { chart_name: 'Store Comparison', position: { x: 0, y: 2, w: 4, h: 2 } },
    { chart_name: 'Top Films', position: { x: 4, y: 2, w: 4, h: 2 } },
    { chart_name: 'Inventory Utilization', position: { x: 0, y: 4, w: 3, h: 2 } },
  ];

  for (const widget of widgets) {
    const chart = charts.find(c => c.name === widget.chart_name);
    if (!chart) continue;

    const widgetId = uuidv4();

    await db.insertInto('dashboard_widgets').values({
      id: widgetId,
      dashboard_id: dashboardId,
      widget_type: 'chart',
      chart_id: chart.id,
      position_config: JSON.stringify({
        x: widget.position.x,
        y: widget.position.y,
        w: widget.position.w,
        h: widget.position.h,
      }),
      widget_config: JSON.stringify({
        title: widget.chart_name,
      }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).execute();

    console.log(`  ✓ Created widget: ${widget.chart_name}`);
  }

  console.log(`\n✅ Created dashboard with ${widgets.length} widgets\n`);
}

async function main() {
  try {
    console.log('\n🚀 Starting Sakila Analytics seed...\n');

    const queryIds = await seedQueries();
    await seedReports(queryIds);
    await seedCharts(queryIds);
    await seedDashboards(queryIds);

    console.log('✨ Seed completed successfully!\n');
    console.log('Summary:');
    console.log(`  - ${Object.keys(queryIds).length} Saved Queries`);
    console.log(`  - 4 Reports`);
    console.log(`  - 8 Charts`);
    console.log(`  - 1 Dashboard with 5 Widgets\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

main();
