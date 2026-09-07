import { getDb } from "../src/lib/db/config";
import { DataSourceService } from "../src/lib/services/data-source.service";

const db = getDb();

// Get admin user
const adminUser = await db
  .selectFrom("users")
  .selectAll()
  .where("email", "=", "admin@admin.com")
  .executeTakeFirst();

if (!adminUser) {
  console.error("Admin user not found!");
  process.exit(1);
}

console.log(`Using admin user: ${adminUser.id}`);

// Hospital Management System PostgreSQL configuration
const hospitalConfig = {
  host: "localhost",
  port: 5432,
  database: "hospital_management_system",
  user: "postgres",
  password: "postgres",
};

try {
  console.log("\nCreating Hospital Management System data source...");
  const dataSource = await DataSourceService.create({
    name: "hospital_management_system",
    clientType: "pg",
    description: "Local PostgreSQL database with hospital management schema",
    connectionConfig: {
      host: hospitalConfig.host,
      port: hospitalConfig.port,
      database: hospitalConfig.database,
      user: hospitalConfig.user,
      password: hospitalConfig.password,
      ssl: false,
    },
    userId: adminUser.id,
  });

  console.log("✅ Hospital data source created successfully!");
  console.log(`ID: ${dataSource.id}`);
  console.log(`Name: ${dataSource.name}`);

  // Test the connection
  console.log("\n🔗 Testing connection to Hospital Database...");
  try {
    const { getConnection } = await import("../src/lib/db/connection-manager");
    const { sql } = await import("kysely");

    // Get the full dataSource with encrypted connection_config from the database
    const fullDataSourceForConnection = await db
      .selectFrom("data_sources")
      .selectAll()
      .where("id", "=", dataSource.id)
      .executeTakeFirst();

    if (!fullDataSourceForConnection) {
      throw new Error("Failed to retrieve data source from database");
    }

    const connection = await getConnection(fullDataSourceForConnection as any);

    // Execute a simple query to test the connection
    const result = await (connection as any)
      .selectFrom(sql`(SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public')`)
      .selectAll()
      .execute();

    console.log("✅ Connection test successful!");
    if (result[0]) {
      console.log(`Tables in database: ${(result[0] as any).table_count}`);
    }
  } catch (testError) {
    console.error("❌ Connection test failed!");
    console.error(`Error: ${testError instanceof Error ? testError.message : String(testError)}`);
  }
} catch (error) {
  console.error("❌ Error creating data source:");
  console.error(error);
  process.exit(1);
}

process.exit(0);
