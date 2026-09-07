import { getDb } from "../src/lib/db/config";

const db = getDb();

// Get hospital data source
const dataSource = await db
  .selectFrom("data_sources")
  .selectAll()
  .where("name", "=", "hospital_management_system")
  .executeTakeFirst();

if (!dataSource) {
  console.error("hospital_management_system data source not found");
  process.exit(1);
}

console.log(`✅ Found data source: ${dataSource.name} (${dataSource.id})`);
console.log(`Testing NL Query endpoint...`);

// Test the CopilotKit endpoint
const response = await fetch("http://localhost:4050/api/copilotkit", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    path: "/execute",
    input: {
      message: "How many patients are in the database?",
      dataSourceId: dataSource.id,
    },
  }),
});

const result = await response.json();
console.log("\nResponse:");
console.log(JSON.stringify(result, null, 2));

process.exit(0);
