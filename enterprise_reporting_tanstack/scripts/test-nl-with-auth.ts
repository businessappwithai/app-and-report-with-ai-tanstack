import { getDb } from "../src/lib/db/config";
import { createSession } from "../src/lib/auth/session";

const db = getDb();

// Get admin user
const adminUser = await db
  .selectFrom("users")
  .selectAll()
  .where("email", "=", "admin@admin.com")
  .executeTakeFirst();

if (!adminUser) {
  console.error("Admin user not found");
  process.exit(1);
}

// Create a valid session token
const sessionToken = await createSession({
  id: adminUser.id,
  email: adminUser.email,
  roles: ["admin"],
  name: adminUser.name || "Admin",
});

console.log(`✅ Created session token for: ${adminUser.email}`);

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

console.log(`✅ Found data source: ${dataSource.name}`);
console.log(`\n🔗 Testing NL Query with authentication...`);

// Test the CopilotKit endpoint with session token
const response = await fetch("http://localhost:4050/api/copilotkit", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Cookie": `session_token=${sessionToken}`,
  },
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

if (result.success) {
  console.log("\n✅ NL Query test successful!");
  console.log(`\nGenerated SQL:\n${result.result.sql}`);
} else {
  console.log("\n❌ NL Query test failed!");
  console.log(`Error: ${result.error}`);
}

process.exit(0);
