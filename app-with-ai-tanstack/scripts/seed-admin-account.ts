import { getDatabase, runMigrations } from "@appwithai/core/services";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${password}salt-key`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function seedAdminAccount() {
  try {
    console.log("🚀 Running migrations...");
    await runMigrations();

    const db = getDatabase();
    const email = "admin@admin.com";
    const password = "administrator";

    console.log("📝 Creating admin account...");

    // Check if user already exists
    const existingUser = await db
      .selectFrom("auth_users")
      .selectAll()
      .where("email", "=", email)
      .executeTakeFirst();

    if (existingUser) {
      console.log(`⚠️  User already exists: ${email}`);
      console.log("   Updating to admin status...");

      await db
        .updateTable("auth_users")
        .set({ status: "approved", role: "admin" })
        .where("id", "=", existingUser.id)
        .execute();

      console.log(`✅ Admin account ready!`);
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${password}`);
      console.log(`   Role: admin`);
      console.log(`   Status: approved`);
      process.exit(0);
    }

    // Create new admin user
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(password);

    // Insert user with password
    await db
      .insertInto("auth_users")
      .values({
        id: userId,
        email,
        name: "Administrator",
        passwordHash,
        emailVerified: true,
        status: "approved",
        role: "admin",
        createdAt: now,
        updatedAt: now,
      })
      .execute();

    console.log(`✅ Admin account created successfully!`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: admin`);
    console.log(`   Status: approved`);
    console.log(``);
    console.log(`🔐 You can now log in at: http://localhost:3000/login`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin account:", error);
    process.exit(1);
  }
}

seedAdminAccount();
