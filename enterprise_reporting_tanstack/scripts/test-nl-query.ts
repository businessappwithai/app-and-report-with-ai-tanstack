import { getDb } from "../src/lib/db/config";

const db = getDb();

// Get both data sources
const dataSources = await db
  .selectFrom("data_sources")
  .selectAll()
  .where("is_deleted", "=", false)
  .execute();

console.log(`Found ${dataSources.length} data sources:`);
dataSources.forEach((ds) => {
  console.log(`- ${ds.name} (${ds.client_type}): ${ds.is_active ? "active" : "inactive"}`);
});

// Test NL Query endpoint
console.log("\n🔗 Testing NL Query endpoint...");

const nlQuestion = "Count all patients by gender";
const targetDataSourceId = dataSources.find((ds) => ds.name === "hospital_management_system")?.id;

if (!targetDataSourceId) {
  console.error("❌ hospital_management_system data source not found");
  process.exit(1);
}

try {
  const response = await fetch("http://localhost:4050/api/copilotkit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": "session_token=test",
    },
    body: JSON.stringify({
      path: "/execute",
      input: {
        message: nlQuestion,
        dataSourceId: targetDataSourceId,
      },
    }),
  });

  const result = await response.json();
  console.log("Response:", JSON.stringify(result, null, 2));

  if (result.success) {
    console.log("✅ NL Query generation successful!");
    console.log(`Generated SQL: ${result.result.sql}`);
  } else {
    console.error("❌ NL Query generation failed!");
    console.error(`Error: ${result.error}`);
  }
} catch (error) {
  console.error("❌ Request failed:", error);
}

process.exit(0);
