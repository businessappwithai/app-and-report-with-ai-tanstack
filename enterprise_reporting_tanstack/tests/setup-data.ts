/**
 * Test Data Setup Script
 *
 * This script prepares the database with test data for E2E testing.
 * Run with: npm run test:setup
 *
 * Or import and use in your test setup.
 */

import bcrypt from 'bcryptjs';
import { getDb } from '../src/lib/db/config';
import type { User, DataSource } from '../src/types/database';

interface TestUserData {
  id: string;
  email: string;
  password: string;
  displayName: string;
}

const TEST_USERS: TestUserData[] = [
  {
    id: 'usr_test_admin_001',
    email: 'admin@admin.com',
    password: 'admin',
    displayName: 'Admin User',
  },
];

const TEST_DATA_SOURCES: Omit<DataSource, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Sample SQLite Database',
    description: 'Sample database with users, orders, and products',
    client_type: 'sqlite3',
    connection_config: JSON.stringify({
      filename: '/Users/pramodkoshy/projects/dynamic/test/enterprise_reporting_system/database/sample.db',
    }),
    is_active: true,
  },
];

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function userExists(db: any, email: string): Promise<boolean> {
  const user = await db.selectFrom('users').where('email', '=', email).selectAll().executeTakeFirst();
  return !!user;
}

export async function setupTestUsers() {
  const db = getDb();

  for (const userData of TEST_USERS) {
    const exists = await userExists(db, userData.email);

    if (exists) {
      console.log(`ℹ️  User ${userData.email} already exists, skipping...`);
      continue;
    }

    const passwordHash = await hashPassword(userData.password);

    await db.insertInto('users').values({
      id: userData.id,
      email: userData.email,
      display_name: userData.displayName,
      password_hash: passwordHash,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).execute();

    console.log(`✅ Created test user: ${userData.email}`);
  }
}

export async function setupTestDataSources() {
  const db = getDb();

  for (let i = 0; i < TEST_DATA_SOURCES.length; i++) {
    const ds = TEST_DATA_SOURCES[i];
    const id = `ds_test_${String(i + 1).padStart(3, '0')}`;

    const exists = await db.selectFrom('data_sources').where('id', '=', id).selectAll().executeTakeFirst();
    if (exists) {
      console.log(`ℹ️  Data source "${ds.name}" already exists, skipping...`);
      continue;
    }

    await db.insertInto('data_sources').values({
      id,
      ...ds,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).execute();

    console.log(`✅ Created test data source: ${ds.name}`);
  }
}

export async function setupAllTestData() {
  console.log('🔧 Setting up test data...\n');

  try {
    await setupTestUsers();
    console.log('');
    await setupTestDataSources();
    console.log('\n✅ Test data setup complete!');
    console.log('\nYou can now run E2E tests with:');
    console.log('  npm run test:e2e');
  } catch (error) {
    console.error('\n❌ Error setting up test data:', error);
    throw error;
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupAllTestData()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
