import { getDb } from '../src/lib/db/config';
import bcrypt from 'bcrypt';
import { isAdmin, getUserPermissions } from '../src/lib/permissions/permissions';

async function testAdminPermissions() {
  const db = getDb();

  try {
    const admin = await db.selectFrom('users').selectAll().where('email', '=', 'admin@admin.com').executeTakeFirst();
    if (!admin) {
      console.log('❌ Admin user not found');
      return;
    }
    console.log('✓ Admin user found:', admin.email, '| ID:', admin.id);

    const passwordValid = await bcrypt.compare('admin', admin.password_hash);
    console.log(passwordValid ? '✓ Password valid' : '❌ Password invalid');

    const adminCheck = await isAdmin(admin.id);
    console.log(adminCheck ? '✓ isAdmin() returns true' : '❌ isAdmin() returns false');

    const perms = await getUserPermissions(admin.id);
    console.log('✓ Roles:', perms.roles.map(r => r.name));
    console.log('✓ Role permissions:', perms.rolePermissions);
    console.log('✓ Number of permissions:', perms.rolePermissions.length);

    const hasUserView = perms.rolePermissions.some(p =>
      p === 'user:view' || p === 'user:*' || p === 'admin:*' || p === '*:*'
    );
    const hasRoleView = perms.rolePermissions.some(p =>
      p === 'role:view' || p === 'role:*' || p === 'admin:*' || p === '*:*'
    );

    console.log(hasUserView ? '✓ Has user:view permission' : '❌ Missing user:view permission');
    console.log(hasRoleView ? '✓ Has role:view permission' : '❌ Missing role:view permission');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.destroy();
  }
}

testAdminPermissions();
