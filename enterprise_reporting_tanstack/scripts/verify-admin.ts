import { getDb } from '../src/lib/db/config';
import bcrypt from 'bcrypt';

async function verifyAdmin() {
  const db = getDb();
  const admin = await db.selectFrom('users').selectAll().where('email', '=', 'admin@admin.com').executeTakeFirst();

  if (admin) {
    console.log('Admin user found:', admin.email);
    const isValid = await bcrypt.compare('admin', admin.password_hash);
    console.log('Password validation:', isValid ? 'SUCCESS ✓' : 'FAILED ✗');

    if (!isValid) {
      console.log('Password hash starts with:', admin.password_hash.substring(0, 20));
    }
  } else {
    console.log('Admin user NOT found');
  }

  await db.destroy();
}

verifyAdmin();
