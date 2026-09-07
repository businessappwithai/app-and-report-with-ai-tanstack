import { getDb } from '../src/lib/db/config';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

async function createAdminUser() {
  const db = getDb();

  try {
    const existingAdmin = await db.selectFrom('users').selectAll().where('email', '=', 'admin@admin.com').executeTakeFirst();
    if (existingAdmin) {
      console.log('Admin user already exists!');
      const adminRoles = await db
        .selectFrom('user_roles as ur')
        .innerJoin('roles as r', 'r.id', 'ur.role_id')
        .selectAll('r')
        .where('ur.user_id', '=', existingAdmin.id)
        .execute();

      if (adminRoles.length > 0) {
        console.log('Admin roles:', adminRoles.map(r => r.name));
      } else {
        console.log('Admin user has no roles assigned');
      }

      const testHash = await bcrypt.compare('admin', existingAdmin.password_hash);
      if (!testHash) {
        console.log('Updating password hash to use bcrypt...');
        const newPasswordHash = await bcrypt.hash('admin', 10);
        await db.updateTable('users')
          .set({ password_hash: newPasswordHash, updated_at: new Date().toISOString() })
          .where('id', '=', existingAdmin.id)
          .execute();
        console.log('Password hash updated successfully!');
      }
      return;
    }

    let adminRole = await db.selectFrom('roles').selectAll().where('name', '=', 'Admin').executeTakeFirst();
    if (!adminRole) {
      const roleId = randomUUID();
      const now = new Date().toISOString();
      await db.insertInto('roles').values({
        id: roleId,
        name: 'Admin',
        description: 'Full system administrator with access to all features',
        permissions: JSON.stringify(['admin:*', 'user:*', 'role:*', 'dashboard:*', 'chart:*', 'report:*', 'query:*', 'data_source:*', 'filter:*', 'job:*']),
        created_at: now,
      }).execute();
      adminRole = await db.selectFrom('roles').selectAll().where('id', '=', roleId).executeTakeFirst();
      console.log('Created Admin role');
    }

    const userId = randomUUID();
    const passwordHash = await bcrypt.hash('admin', 10);
    const now = new Date().toISOString();

    await db.insertInto('users').values({
      id: userId,
      email: 'admin@admin.com',
      password_hash: passwordHash,
      display_name: 'Administrator',
      avatar_url: null,
      is_active: true,
      created_at: now,
      updated_at: now,
    }).execute();

    await db.insertInto('user_roles').values({
      user_id: userId,
      role_id: adminRole!.id,
      assigned_at: now,
    }).execute();

    console.log('✅ Successfully created admin user:');
    console.log('   Email: admin@admin.com');
    console.log('   Password: admin');
    console.log('   Role: Admin');
    console.log('');
    console.log('You can now log in at: http://localhost:4050');
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

createAdminUser();
