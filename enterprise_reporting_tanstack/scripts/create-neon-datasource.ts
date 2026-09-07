import { getDb } from "../src/lib/db/config";
import { DataSourceService } from "../src/lib/services/data-source.service";

const db = getDb();

// Get the admin user ID (first user created)
const adminUser = await db
  .selectFrom("users")
  .selectAll()
  .where("email", "=", "admin@admin.com")
  .executeTakeFirst();

if (!adminUser) {
  console.error("Admin user not found!");
  process.exit(1);
}

console.log(`Using admin user: ${adminUser.id} (${adminUser.email})`);

// Neon connection details extracted from the connection string
// postgresql://neondb_owner:npg_Zzp29WIvYOxn@ep-little-dawn-aqcbpctg-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

const neonConfig = {
  host: "ep-little-dawn-aqcbpctg-pooler.c-8.us-east-1.aws.neon.tech",
  port: 5432,
  database: "neondb",
  user: "neondb_owner",
  password: "npg_Zzp29WIvYOxn",
  ssl: true, // Neon requires SSL
};

try {
  console.log("\nCreating Neon DB data source...");
  const dataSource = await DataSourceService.create({
    name: "Neon PostgreSQL",
    clientType: "pg",
    description: "Cloud PostgreSQL database on Neon",
    connectionConfig: {
      host: neonConfig.host,
      port: neonConfig.port,
      database: neonConfig.database,
      user: neonConfig.user,
      password: neonConfig.password,
      ssl: neonConfig.ssl,
    },
    userId: adminUser.id,
  });

  console.log("✅ Neon data source created successfully!");
  console.log(`ID: ${dataSource.id}`);
  console.log(`Name: ${dataSource.name}`);
  console.log(`Client Type: ${dataSource.client_type}`);
  console.log(`Active: ${dataSource.is_active}`);
  console.log(`Created: ${dataSource.created_at}`);

  // Get the decrypted connection config to display (without password)
  const fullDataSource = await DataSourceService.getById(dataSource.id, true);
  if (fullDataSource?.connection_config) {
    console.log("\nConnection Config (without password):");
    const config = fullDataSource.connection_config as Record<string, unknown>;
    console.log(`  Host: ${config.host}`);
    console.log(`  Port: ${config.port}`);
    console.log(`  Database: ${config.database}`);
    console.log(`  User: ${config.user}`);
    console.log(`  SSL: ${config.ssl}`);
  }

  // Test the connection by attempting to get the connection
  console.log("\n🔗 Testing connection to Neon...");
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

    // Execute a simple query to test the connection using Kysely's sql template
    const result = await (connection as any).selectFrom(sql`(SELECT 1 as test)`).selectAll().execute();
    console.log("✅ Connection test successful!");
    console.log("✅ Connected to Neon database successfully!");
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
