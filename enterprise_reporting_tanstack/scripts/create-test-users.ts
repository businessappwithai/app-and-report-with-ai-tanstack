/**
 * Create test users with different roles and permissions
 * Run: DATABASE_URL="postgresql://postgres@localhost:5432/hospital_management_system" bun scripts/create-test-users.ts
 */
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const DATABASE_URL = process.env.DATABASE_URL || "";
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const client = await pool.connect();

try {
  console.log("Creating test users...");

  // Get role IDs
  const rolesResult = await client.query("SELECT id, name FROM roles");
  const roles = rolesResult.rows.reduce(
    (acc: Record<string, string>, row) => {
      acc[row.name.toLowerCase()] = row.id;
      return acc;
    },
    {}
  );

  console.log("Available roles:", roles);

  // Create test users
  const testUsers = [
    {
      email: "viewer@example.com",
      password: "SecureViewer123!",
      displayName: "Viewer User",
      roles: ["viewer"],
    },
    {
      email: "editor@example.com",
      password: "SecureEditor123!",
      displayName: "Editor User",
      roles: ["user"],
    },
    {
      email: "admin2@example.com",
      password: "SecureAdmin123!",
      displayName: "Second Admin",
      roles: ["admin"],
    },
    {
      email: "manager@example.com",
      password: "SecureManager123!",
      displayName: "Manager User",
      roles: ["user"],
    },
  ];

  for (const testUser of testUsers) {
    const userId = randomUUID();
    const passwordHash = await bcrypt.hash(testUser.password, 10);

    // Insert user
    await client.query(
      `INSERT INTO users (id, email, password_hash, display_name, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [userId, testUser.email, passwordHash, testUser.displayName, true]
    );

    console.log(`✓ Created user: ${testUser.email}`);

    // Assign roles
    for (const roleName of testUser.roles) {
      const roleId = roles[roleName.toLowerCase()];
      if (roleId) {
        await client.query(
          `INSERT INTO user_roles (user_id, role_id, assigned_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP)`,
          [userId, roleId]
        );
        console.log(`  ✓ Assigned role: ${roleName}`);
      }
    }
  }

  // List all users
  console.log("\nAll users in database:");
  const allUsersResult = await client.query(
    `SELECT u.email, u.display_name, r.name as role
     FROM users u
     LEFT JOIN user_roles ur ON u.id = ur.user_id
     LEFT JOIN roles r ON ur.role_id = r.id
     ORDER BY u.email`
  );

  allUsersResult.rows.forEach((row) => {
    console.log(
      `  ${row.email.padEnd(25)} | ${row.display_name.padEnd(20)} | ${row.role || "NO ROLE"}`
    );
  });

  console.log("\n✅ Test users created successfully!");
  console.log("\nTest Credentials:");
  console.log(
    "  Viewer: viewer@example.com / SecureViewer123!"
  );
  console.log(
    "  Editor: editor@example.com / SecureEditor123!"
  );
  console.log(
    "  Admin:  admin2@example.com / SecureAdmin123!"
  );
  console.log(
    "  Manager: manager@example.com / SecureManager123!"
  );
} finally {
  await client.end();
  await pool.end();
  process.exit(0);
}
