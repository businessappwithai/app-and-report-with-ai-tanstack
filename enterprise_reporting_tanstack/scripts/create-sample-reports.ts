/**
 * Create sample reports, charts, and dashboards using bus_patient data
 * Run: DATABASE_URL="postgresql://postgres@localhost:5432/hospital_management_system" bun scripts/create-sample-reports.ts
 */
import { Pool } from "pg";
import { randomUUID } from "node:crypto";

const DATABASE_URL = process.env.DATABASE_URL || "";
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const client = await pool.connect();

try {
  console.log("Creating sample reports and charts...");

  // Get data source ID and admin user ID
  const dsResult = await client.query(
    "SELECT id FROM data_sources WHERE name = $1",
    ["Hospital Management System"]
  );
  const dataSourceId = dsResult.rows[0].id;

  const userResult = await client.query(
    "SELECT id FROM users WHERE email = $1",
    ["admin@admin.com"]
  );
  const userId = userResult.rows[0].id;

  console.log(`Using data source: ${dataSourceId}`);
  console.log(`Using user: ${userId}`);

  // Create saved queries
  const queries = [
    {
      id: randomUUID(),
      name: "Patient Count by Age Group",
      description: "Count of patients grouped by age ranges",
      sql: `SELECT
        CASE
          WHEN age < 18 THEN 'Child (0-17)'
          WHEN age BETWEEN 18 AND 30 THEN 'Young Adult (18-30)'
          WHEN age BETWEEN 31 AND 50 THEN 'Adult (31-50)'
          WHEN age BETWEEN 51 AND 65 THEN 'Senior (51-65)'
          ELSE 'Elderly (65+)'
        END as age_group,
        COUNT(*) as patient_count
      FROM bus_patient
      GROUP BY age_group
      ORDER BY patient_count DESC;`,
    },
    {
      id: randomUUID(),
      name: "Patients by Gender",
      description: "Distribution of patients by gender",
      sql: `SELECT
        gender,
        COUNT(*) as patient_count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM bus_patient
      GROUP BY gender
      ORDER BY patient_count DESC;`,
    },
    {
      id: randomUUID(),
      name: "Top 10 Patient Details",
      description: "Sample of 10 patients with their details",
      sql: `SELECT
        id,
        name,
        age,
        gender,
        city,
        state,
        medical_condition
      FROM bus_patient
      LIMIT 10;`,
    },
    {
      id: randomUUID(),
      name: "Patients by Medical Condition",
      description: "Count of patients grouped by medical condition",
      sql: `SELECT
        medical_condition,
        COUNT(*) as patient_count
      FROM bus_patient
      WHERE medical_condition IS NOT NULL
      GROUP BY medical_condition
      ORDER BY patient_count DESC;`,
    },
    {
      id: randomUUID(),
      name: "Patients by City",
      description: "Distribution of patients by city",
      sql: `SELECT
        city,
        COUNT(*) as patient_count
      FROM bus_patient
      WHERE city IS NOT NULL
      GROUP BY city
      ORDER BY patient_count DESC
      LIMIT 15;`,
    },
  ];

  console.log("Creating saved queries...");
  const now = new Date().toISOString();

  for (const query of queries) {
    await client.query(
      `INSERT INTO saved_queries (id, name, description, data_source_id, sql_content, is_validated, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        query.id,
        query.name,
        query.description,
        dataSourceId,
        query.sql,
        true,
        userId,
        now,
        now,
      ]
    );
    console.log(`✓ Created query: ${query.name}`);
  }

  // Create reports based on saved queries
  console.log("\nCreating reports...");
  const reports = [
    {
      id: randomUUID(),
      name: "Patient Demographics",
      description: "Age and gender distribution of patients",
      savedQueryId: queries[0].id,
      columnConfig: [
        { field: "age_group", label: "Age Group" },
        { field: "patient_count", label: "Count" },
      ],
    },
    {
      id: randomUUID(),
      name: "Gender Distribution",
      description: "Breakdown of patients by gender",
      savedQueryId: queries[1].id,
      columnConfig: [
        { field: "gender", label: "Gender" },
        { field: "patient_count", label: "Count" },
        { field: "percentage", label: "Percentage" },
      ],
    },
    {
      id: randomUUID(),
      name: "Patient Listing",
      description: "Sample of patient records with key information",
      savedQueryId: queries[2].id,
      columnConfig: [
        { field: "id", label: "Patient ID" },
        { field: "name", label: "Name" },
        { field: "age", label: "Age" },
        { field: "gender", label: "Gender" },
        { field: "city", label: "City" },
        { field: "state", label: "State" },
        { field: "medical_condition", label: "Condition" },
      ],
    },
    {
      id: randomUUID(),
      name: "Medical Conditions",
      description: "Count of patients by medical condition",
      savedQueryId: queries[3].id,
      columnConfig: [
        { field: "medical_condition", label: "Condition" },
        { field: "patient_count", label: "Count" },
      ],
    },
    {
      id: randomUUID(),
      name: "Geographic Distribution",
      description: "Top cities by patient count",
      savedQueryId: queries[4].id,
      columnConfig: [
        { field: "city", label: "City" },
        { field: "patient_count", label: "Count" },
      ],
    },
  ];

  for (const report of reports) {
    await client.query(
      `INSERT INTO report_definitions (id, name, description, saved_query_id, column_config, export_formats, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        report.id,
        report.name,
        report.description,
        report.savedQueryId,
        JSON.stringify(report.columnConfig),
        JSON.stringify(["csv", "xlsx", "pdf"]),
        userId,
        now,
        now,
      ]
    );
    console.log(`✓ Created report: ${report.name}`);
  }

  // Create charts based on saved queries
  console.log("\nCreating charts...");
  const charts = [
    {
      id: randomUUID(),
      name: "Age Distribution Chart",
      description: "Pie chart showing patient distribution by age group",
      savedQueryId: queries[0].id,
      chartType: "pie",
      dataMapping: {
        xAxis: "age_group",
        yAxis: "patient_count",
        label: "age_group",
        value: "patient_count",
      },
    },
    {
      id: randomUUID(),
      name: "Gender Distribution Chart",
      description: "Bar chart showing patient count by gender",
      savedQueryId: queries[1].id,
      chartType: "bar",
      dataMapping: {
        xAxis: "gender",
        yAxis: "patient_count",
      },
    },
    {
      id: randomUUID(),
      name: "Medical Conditions Chart",
      description: "Bar chart of patients by medical condition",
      savedQueryId: queries[3].id,
      chartType: "bar",
      dataMapping: {
        xAxis: "medical_condition",
        yAxis: "patient_count",
      },
    },
    {
      id: randomUUID(),
      name: "City Distribution Chart",
      description: "Top cities by patient count",
      savedQueryId: queries[4].id,
      chartType: "bar",
      dataMapping: {
        xAxis: "city",
        yAxis: "patient_count",
      },
    },
  ];

  for (const chart of charts) {
    await client.query(
      `INSERT INTO chart_definitions (id, name, description, saved_query_id, chart_type, data_mapping, color_theme, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        chart.id,
        chart.name,
        chart.description,
        chart.savedQueryId,
        chart.chartType,
        JSON.stringify(chart.dataMapping),
        "default",
        userId,
        now,
        now,
      ]
    );
    console.log(`✓ Created chart: ${chart.name}`);
  }

  // Create a dashboard with multiple widgets
  console.log("\nCreating dashboard...");
  const dashboardId = randomUUID();

  await client.query(
    `INSERT INTO dashboard_layouts (id, name, description, layout_config, theme_config, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      dashboardId,
      "Hospital Patient Analytics",
      "Comprehensive view of patient demographics and health conditions",
      JSON.stringify({
        columns: 2,
        gap: 16,
      }),
      JSON.stringify({ mode: "light" }),
      userId,
      now,
      now,
    ]
  );
  console.log(`✓ Created dashboard: Hospital Patient Analytics`);

  // Add widgets to dashboard
  console.log("\nAdding widgets to dashboard...");
  const widgets = [
    {
      widgetType: "report",
      resourceId: reports[0].id,
      position: 0,
    },
    {
      widgetType: "chart",
      resourceId: charts[0].id,
      position: 1,
    },
    {
      widgetType: "report",
      resourceId: reports[1].id,
      position: 2,
    },
    {
      widgetType: "chart",
      resourceId: charts[1].id,
      position: 3,
    },
    {
      widgetType: "report",
      resourceId: reports[3].id,
      position: 4,
    },
    {
      widgetType: "chart",
      resourceId: charts[2].id,
      position: 5,
    },
  ];

  for (const widget of widgets) {
    const widgetId = randomUUID();
    const reportId = widget.widgetType === "report" ? widget.resourceId : null;
    const chartId = widget.widgetType === "chart" ? widget.resourceId : null;

    await client.query(
      `INSERT INTO dashboard_widgets (id, dashboard_id, widget_type, report_id, chart_id, position_config, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        widgetId,
        dashboardId,
        widget.widgetType,
        reportId,
        chartId,
        JSON.stringify({ position: widget.position, size: "medium" }),
        now,
        now,
      ]
    );
    console.log(`✓ Added ${widget.widgetType} widget to dashboard`);
  }

  // Add NL query context data for natural language support
  console.log("\nAdding NL query context data...");
  await client.query(
    `INSERT INTO nl_query_context (id, data_source_id, user_id, role_name, nl_question, generated_sql, schema_context, rbac_context, was_successful, created_by, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      randomUUID(),
      dataSourceId,
      userId,
      "Admin",
      "How many patients do we have in total?",
      "SELECT COUNT(*) as total_patients FROM bus_patient;",
      JSON.stringify({
        tables: ["bus_patient"],
        columns: ["id", "name", "age", "gender", "city", "state", "medical_condition"],
      }),
      JSON.stringify({ role: "Admin", permissions: ["read", "write"] }),
      true,
      userId,
      now,
    ]
  );

  await client.query(
    `INSERT INTO nl_query_context (id, data_source_id, user_id, role_name, nl_question, generated_sql, schema_context, rbac_context, was_successful, created_by, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      randomUUID(),
      dataSourceId,
      userId,
      "Admin",
      "Show me patient distribution by gender",
      "SELECT gender, COUNT(*) as count FROM bus_patient GROUP BY gender;",
      JSON.stringify({
        tables: ["bus_patient"],
        columns: ["gender"],
      }),
      JSON.stringify({ role: "Admin", permissions: ["read", "write"] }),
      true,
      userId,
      now,
    ]
  );

  console.log("✓ Added NL query context examples");

  console.log("\n✅ Sample data creation complete!");
  console.log("✓ Created 5 saved queries");
  console.log("✓ Created 5 reports");
  console.log("✓ Created 4 charts");
  console.log("✓ Created 1 dashboard with 6 widgets");
  console.log("✓ Added NL query context examples");

} finally {
  await client.end();
  await pool.end();
  process.exit(0);
}
