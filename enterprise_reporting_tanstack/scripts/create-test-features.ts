/**
 * Create comprehensive test data for all features
 * Run: bun scripts/create-test-features.ts
 */

import { jwtVerify, SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const BASE_URL = "http://localhost:4050";
const ADMIN_EMAIL = "admin@admin.com";
const ADMIN_PASSWORD = "Admin123!@";
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres@localhost:5432/hospital_management_system";
const AUTH_SECRET = process.env.AUTH_SECRET || "your-secret-key-min-32-characters-required-here";

interface TestResult {
  feature: string;
  status: "success" | "error";
  message: string;
  id?: string | number;
}

const results: TestResult[] = [];

// Helper to get session via JWT creation
async function getSession(): Promise<string> {
  try {
    // Connect to database to get admin user
    const pool = new Pool({ connectionString: DATABASE_URL });
    const client = await pool.connect();

    try {
      // Get admin user
      const userResult = await client.query(
        "SELECT id, email, password_hash FROM users WHERE email = $1 LIMIT 1",
        [ADMIN_EMAIL]
      );

      if (userResult.rows.length === 0) {
        throw new Error(`Admin user not found: ${ADMIN_EMAIL}`);
      }

      const user = userResult.rows[0];

      // Verify password
      const validPassword = await bcrypt.compare(ADMIN_PASSWORD, user.password_hash);
      if (!validPassword) {
        throw new Error("Invalid password");
      }

      // Get user roles
      const rolesResult = await client.query(
        `SELECT r.id, r.name, r.permissions
         FROM roles r
         INNER JOIN user_roles ur ON r.id = ur.role_id
         WHERE ur.user_id = $1`,
        [user.id]
      );

      const roles = rolesResult.rows.map((r: any) => r.name);
      const permissions = rolesResult.rows.flatMap((r: any) => {
        try {
          return JSON.parse(r.permissions);
        } catch {
          return [];
        }
      });

      // Create JWT
      const secret = new TextEncoder().encode(AUTH_SECRET);
      const jwt = await new SignJWT({
        user: {
          id: user.id,
          email: user.email,
          name: ADMIN_EMAIL,
          roles,
          permissions,
        },
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("30d")
        .sign(secret);

      return jwt;
    } finally {
      await client.end();
      await pool.end();
    }
  } catch (error) {
    throw new Error(
      `Failed to create session: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Get data source ID for HMS
async function getDataSourceId(sessionToken: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/data-sources`, {
    headers: { Cookie: `session_token=${sessionToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to get data sources: ${res.statusText}`);
  }

  const data = await res.json();
  const hmsDatasource = data.data?.find(
    (ds: any) => ds.name === "HMS" || ds.client_type === "postgres"
  );

  if (!hmsDatasource) {
    throw new Error(
      "HMS data source not found. Please create it first via UI."
    );
  }

  return hmsDatasource.id;
}

// Create saved queries
async function createSavedQueries(
  sessionToken: string,
  dataSourceId: string
): Promise<string[]> {
  const queries = [
    {
      name: "Total Patients by Gender",
      description: "Count of patients grouped by gender",
      sqlContent:
        'SELECT gender, COUNT(*) as patient_count FROM bus_patient GROUP BY gender ORDER BY patient_count DESC',
    },
    {
      name: "Patients by Age Group",
      description: "Distribution of patients across age groups",
      sqlContent: `
        SELECT
          CASE
            WHEN age < 18 THEN 'Under 18'
            WHEN age >= 18 AND age < 30 THEN '18-29'
            WHEN age >= 30 AND age < 50 THEN '30-49'
            WHEN age >= 50 AND age < 70 THEN '50-69'
            ELSE '70+'
          END as age_group,
          COUNT(*) as patient_count
        FROM bus_patient
        GROUP BY age_group
        ORDER BY age_group
      `,
    },
    {
      name: "Top 10 Diagnosis Codes",
      description: "Most common diagnosis codes",
      sqlContent: `
        SELECT diagnosis_code, COUNT(*) as occurrence_count
        FROM bus_patient
        WHERE diagnosis_code IS NOT NULL
        GROUP BY diagnosis_code
        ORDER BY occurrence_count DESC
        LIMIT 10
      `,
    },
    {
      name: "Patient Status Distribution",
      description: "Count of patients by status",
      sqlContent: `
        SELECT status, COUNT(*) as patient_count
        FROM bus_patient
        GROUP BY status
        ORDER BY patient_count DESC
      `,
    },
    {
      name: "Average Length of Stay by Ward",
      description: "Average LOS grouped by ward",
      sqlContent: `
        SELECT ward, ROUND(AVG(CAST(length_of_stay AS FLOAT)), 2) as avg_los
        FROM bus_patient
        WHERE length_of_stay IS NOT NULL
        GROUP BY ward
        ORDER BY avg_los DESC
      `,
    },
  ];

  const ids: string[] = [];

  for (const query of queries) {
    try {
      const res = await fetch(`${BASE_URL}/api/queries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_token=${sessionToken}`,
        },
        body: JSON.stringify({
          name: query.name,
          description: query.description,
          dataSourceId: dataSourceId,
          sqlContent: query.sqlContent,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        ids.push(data.data.id);
        results.push({
          feature: `Saved Query: ${query.name}`,
          status: "success",
          message: "Created successfully",
          id: data.data.id,
        });
      } else {
        const errData = await res.text();
        results.push({
          feature: `Saved Query: ${query.name}`,
          status: "error",
          message: `Failed: ${errData}`,
        });
      }
    } catch (error) {
      results.push({
        feature: `Saved Query: ${query.name}`,
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return ids;
}

// Create reports
async function createReports(
  sessionToken: string,
  dataSourceId: string,
  queryIds: string[]
): Promise<string[]> {
  const reports = [
    {
      name: "Patient Demographics Report",
      description: "Comprehensive patient demographics analysis",
      savedQueryId: queryIds[0],
      columnConfig: [
        { field: "gender", label: "Gender", visible: true, sortable: true },
        {
          field: "patient_count",
          label: "Count",
          visible: true,
          sortable: true,
        },
      ],
      exportFormats: ["csv", "xlsx", "pdf"],
    },
    {
      name: "Age Distribution Report",
      description: "Patient distribution by age groups",
      savedQueryId: queryIds[1],
      columnConfig: [
        {
          field: "age_group",
          label: "Age Group",
          visible: true,
          sortable: true,
        },
        {
          field: "patient_count",
          label: "Count",
          visible: true,
          sortable: true,
        },
      ],
      exportFormats: ["csv", "xlsx"],
    },
    {
      name: "Diagnosis Report",
      description: "Top diagnosis codes",
      columnConfig: [
        {
          field: "diagnosis_code",
          label: "Code",
          visible: true,
          sortable: true,
        },
        {
          field: "occurrence_count",
          label: "Occurrences",
          visible: true,
          sortable: true,
        },
      ],
      exportFormats: ["csv"],
    },
  ];

  const ids: string[] = [];

  for (const report of reports) {
    try {
      const res = await fetch(`${BASE_URL}/api/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_token=${sessionToken}`,
        },
        body: JSON.stringify({
          name: report.name,
          description: report.description,
          savedQueryId: report.savedQueryId,
          columnConfig: report.columnConfig,
          exportFormats: report.exportFormats,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        ids.push(data.data.id);
        results.push({
          feature: `Report: ${report.name}`,
          status: "success",
          message: "Created successfully",
          id: data.data.id,
        });
      } else {
        const errData = await res.text();
        results.push({
          feature: `Report: ${report.name}`,
          status: "error",
          message: `Failed: ${errData}`,
        });
      }
    } catch (error) {
      results.push({
        feature: `Report: ${report.name}`,
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return ids;
}

// Create charts
async function createCharts(
  sessionToken: string,
  dataSourceId: string,
  queryIds: string[]
): Promise<string[]> {
  const charts = [
    {
      name: "Gender Distribution Pie Chart",
      description: "Patient distribution by gender",
      chart_type: "pie",
      data_source_id: dataSourceId,
      chart_config: {
        dataKey: "patient_count",
        nameKey: "gender",
        colors: ["#3b82f6", "#ef4444", "#10b981", "#f59e0b"],
      },
    },
    {
      name: "Age Groups Bar Chart",
      description: "Patients by age group",
      chart_type: "bar",
      data_source_id: dataSourceId,
      chart_config: {
        xAxisKey: "age_group",
        yAxisKey: "patient_count",
        colors: ["#3b82f6"],
      },
    },
    {
      name: "Top Diagnosis Codes Bar Chart",
      description: "Most common diagnosis codes",
      chart_type: "bar",
      data_source_id: dataSourceId,
      chart_config: {
        xAxisKey: "diagnosis_code",
        yAxisKey: "occurrence_count",
        colors: ["#ef4444"],
      },
    },
    {
      name: "Status Distribution Donut Chart",
      description: "Patient status breakdown",
      chart_type: "pie",
      data_source_id: dataSourceId,
      chart_config: {
        dataKey: "patient_count",
        nameKey: "status",
        chartStyle: "donut",
      },
    },
    {
      name: "Average LOS by Ward",
      description: "Average length of stay by ward",
      chart_type: "bar",
      data_source_id: dataSourceId,
      chart_config: {
        xAxisKey: "ward",
        yAxisKey: "avg_los",
        colors: ["#8b5cf6"],
      },
    },
  ];

  const ids: string[] = [];

  for (const chart of charts) {
    try {
      const res = await fetch(`${BASE_URL}/api/charts/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_token=${sessionToken}`,
        },
        body: JSON.stringify(chart),
      });

      if (res.ok) {
        const data = await res.json();
        ids.push(data.data.id);
        results.push({
          feature: `Chart: ${chart.name}`,
          status: "success",
          message: "Created successfully",
          id: data.data.id,
        });
      } else {
        const errData = await res.text();
        results.push({
          feature: `Chart: ${chart.name}`,
          status: "error",
          message: `Failed: ${errData}`,
        });
      }
    } catch (error) {
      results.push({
        feature: `Chart: ${chart.name}`,
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return ids;
}

// Create dashboards
async function createDashboards(
  sessionToken: string,
  chartIds: string[]
): Promise<string[]> {
  const dashboards = [
    {
      name: "Patient Analytics Dashboard",
      description: "Comprehensive patient analytics overview",
      layout: {
        title: "Patient Analytics Dashboard",
        gridLayout: [
          {
            i: "0",
            x: 0,
            y: 0,
            w: 6,
            h: 4,
            chartId: chartIds[0],
            title: "Gender Distribution",
          },
          {
            i: "1",
            x: 6,
            y: 0,
            w: 6,
            h: 4,
            chartId: chartIds[1],
            title: "Age Groups",
          },
          {
            i: "2",
            x: 0,
            y: 4,
            w: 12,
            h: 4,
            chartId: chartIds[2],
            title: "Diagnosis Codes",
          },
          {
            i: "3",
            x: 0,
            y: 8,
            w: 6,
            h: 4,
            chartId: chartIds[3],
            title: "Status Distribution",
          },
          {
            i: "4",
            x: 6,
            y: 8,
            w: 6,
            h: 4,
            chartId: chartIds[4],
            title: "Average LOS",
          },
        ],
      },
    },
    {
      name: "Demographics Overview",
      description: "Quick overview of patient demographics",
      layout: {
        title: "Demographics Overview",
        gridLayout: [
          {
            i: "0",
            x: 0,
            y: 0,
            w: 12,
            h: 6,
            chartId: chartIds[0],
            title: "Gender Distribution",
          },
          {
            i: "1",
            x: 0,
            y: 6,
            w: 12,
            h: 6,
            chartId: chartIds[1],
            title: "Age Distribution",
          },
        ],
      },
    },
  ];

  const ids: string[] = [];

  for (const dashboard of dashboards) {
    try {
      const res = await fetch(`${BASE_URL}/api/dashboards/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_token=${sessionToken}`,
        },
        body: JSON.stringify({
          name: dashboard.name,
          description: dashboard.description,
          layout: dashboard.layout,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        ids.push(data.data.id);
        results.push({
          feature: `Dashboard: ${dashboard.name}`,
          status: "success",
          message: "Created successfully",
          id: data.data.id,
        });
      } else {
        const errData = await res.text();
        results.push({
          feature: `Dashboard: ${dashboard.name}`,
          status: "error",
          message: `Failed: ${errData}`,
        });
      }
    } catch (error) {
      results.push({
        feature: `Dashboard: ${dashboard.name}`,
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return ids;
}

// Main execution
async function main() {
  console.log("🚀 Starting test feature creation...\n");

  try {
    // Get session
    console.log("📝 Getting session...");
    const sessionToken = await getSession();
    console.log("✅ Session obtained\n");

    // Get data source
    console.log("🔍 Getting HMS data source...");
    const dataSourceId = await getDataSourceId(sessionToken);
    console.log(`✅ Data source ID: ${dataSourceId}\n`);

    // Create saved queries
    console.log("📊 Creating saved queries...");
    const queryIds = await createSavedQueries(sessionToken, dataSourceId);
    console.log(`✅ Created ${queryIds.length} saved queries\n`);

    // Create reports
    console.log("📋 Creating reports...");
    const reportIds = await createReports(sessionToken, dataSourceId, queryIds);
    console.log(`✅ Created ${reportIds.length} reports\n`);

    // Create charts
    console.log("📈 Creating charts...");
    const chartIds = await createCharts(sessionToken, dataSourceId, queryIds);
    console.log(`✅ Created ${chartIds.length} charts\n`);

    // Create dashboards
    console.log("🎨 Creating dashboards...");
    const dashboardIds = await createDashboards(sessionToken, chartIds);
    console.log(`✅ Created ${dashboardIds.length} dashboards\n`);

    // Print results
    console.log("\n" + "=".repeat(60));
    console.log("📊 TEST FEATURE CREATION RESULTS");
    console.log("=".repeat(60) + "\n");

    const successes = results.filter((r) => r.status === "success");
    const errors = results.filter((r) => r.status === "error");

    console.log(`✅ Successes: ${successes.length}`);
    successes.forEach((r) => {
      console.log(`  • ${r.feature}: ${r.message}${r.id ? ` (ID: ${r.id})` : ""}`);
    });

    if (errors.length > 0) {
      console.log(`\n❌ Errors: ${errors.length}`);
      errors.forEach((r) => {
        console.log(`  • ${r.feature}: ${r.message}`);
      });
    }

    console.log("\n" + "=".repeat(60));
    console.log("✨ Test data creation complete!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

main();
