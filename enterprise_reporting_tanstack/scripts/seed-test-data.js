#!/usr/bin/env node

/**
 * Seed test data for QA testing
 * Creates admin user, sample roles, and data sources
 */

const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

// Hash password using bcryptjs-like logic (simplified)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function seedDatabase() {
  try {
    const dbPath = path.join(__dirname, '..', 'data', 'config.sqlite');
    console.log(`📦 Opening database: ${dbPath}`);

    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    console.log('🔧 Creating test data...\n');

    // 1. Create roles
    console.log('📋 Creating roles...');
    const roles = [
      {
        id: 'role-admin-' + Date.now(),
        name: 'Admin',
        description: 'Full system access',
        permissions: JSON.stringify([
          'admin:*',
          'data_source:*',
          'query:*',
          'report:*',
          'chart:*',
          'dashboard:*',
          'job:*',
          'user:*',
        ]),
      },
      {
        id: 'role-analyst-' + Date.now(),
        name: 'Analyst',
        description: 'Can create and execute reports',
        permissions: JSON.stringify([
          'data_source:view',
          'query:*',
          'report:*',
          'chart:*',
          'dashboard:view',
          'dashboard:edit',
          'job:execute',
        ]),
      },
      {
        id: 'role-viewer-' + Date.now(),
        name: 'Viewer',
        description: 'View-only access',
        permissions: JSON.stringify([
          'data_source:view',
          'query:view',
          'report:view',
          'report:export',
          'chart:view',
          'dashboard:view',
        ]),
      },
    ];

    const insertRole = db.prepare(`
      INSERT INTO roles (id, name, description, permissions, created_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const adminRoleId = roles[0].id;
    const analystRoleId = roles[1].id;
    const viewerRoleId = roles[2].id;

    roles.forEach(role => {
      try {
        insertRole.run(role.id, role.name, role.description, role.permissions);
        console.log(`  ✅ Created role: ${role.name}`);
      } catch (e) {
        if (!e.message.includes('UNIQUE constraint failed')) {
          console.log(`  ⚠️  ${role.name} already exists`);
        }
      }
    });

    // 2. Create users
    console.log('\n👥 Creating test users...');
    const users = [
      {
        id: 'user-admin-' + Date.now(),
        email: 'admin@example.com',
        password_hash: hashPassword('admin123'),
        display_name: 'Admin User',
        is_active: true,
        roleId: adminRoleId,
      },
      {
        id: 'user-analyst-' + Date.now(),
        email: 'analyst@example.com',
        password_hash: hashPassword('analyst123'),
        display_name: 'Analyst User',
        is_active: true,
        roleId: analystRoleId,
      },
      {
        id: 'user-viewer-' + Date.now(),
        email: 'viewer@example.com',
        password_hash: hashPassword('viewer123'),
        display_name: 'Viewer User',
        is_active: true,
        roleId: viewerRoleId,
      },
    ];

    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const insertUserRole = db.prepare(`
      INSERT INTO user_roles (user_id, role_id)
      VALUES (?, ?)
    `);

    users.forEach(user => {
      try {
        insertUser.run(
          user.id,
          user.email,
          user.password_hash,
          user.display_name,
          user.is_active ? 1 : 0
        );
        insertUserRole.run(user.id, user.roleId);
        console.log(`  ✅ Created user: ${user.email} (${user.display_name})`);
      } catch (e) {
        if (!e.message.includes('UNIQUE constraint failed')) {
          console.log(`  ⚠️  ${user.email} already exists`);
        }
      }
    });

    // 3. Create sample data sources
    console.log('\n🗄️  Creating sample data sources...');
    const dataSources = [
      {
        id: 'ds-sqlite-' + Date.now(),
        name: 'Local SQLite',
        description: 'Sample SQLite database',
        client_type: 'sqlite',
        connection_params: JSON.stringify({
          database: ':memory:',
        }),
        created_by: users[0].id,
      },
      {
        id: 'ds-postgres-' + Date.now(),
        name: 'PostgreSQL Sample',
        description: 'Sample PostgreSQL connection',
        client_type: 'pg',
        connection_params: JSON.stringify({
          host: 'localhost',
          port: 5432,
          user: 'postgres',
          password: 'password',
          database: 'sample_db',
        }),
        created_by: users[0].id,
      },
    ];

    const insertDataSource = db.prepare(`
      INSERT INTO data_sources
      (id, name, description, client_type, connection_params, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    dataSources.forEach(ds => {
      try {
        insertDataSource.run(
          ds.id,
          ds.name,
          ds.description,
          ds.client_type,
          ds.connection_params,
          ds.created_by
        );
        console.log(`  ✅ Created data source: ${ds.name}`);
      } catch (e) {
        if (!e.message.includes('UNIQUE constraint failed')) {
          console.log(`  ⚠️  Data source already exists`);
        }
      }
    });

    // 4. Create sample saved queries
    console.log('\n💾 Creating sample queries...');
    const queries = [
      {
        id: 'query-sample-' + Date.now(),
        name: 'Sample SELECT Query',
        description: 'Simple SELECT query for testing',
        sql: 'SELECT 1 as id, "Test" as name',
        data_source_id: dataSources[0].id,
        created_by: users[0].id,
      },
    ];

    const insertQuery = db.prepare(`
      INSERT INTO saved_queries
      (id, name, description, sql, data_source_id, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    queries.forEach(q => {
      try {
        insertQuery.run(
          q.id,
          q.name,
          q.description,
          q.sql,
          q.data_source_id,
          q.created_by
        );
        console.log(`  ✅ Created query: ${q.name}`);
      } catch (e) {
        if (!e.message.includes('UNIQUE constraint failed')) {
          console.log(`  ⚠️  Query already exists`);
        }
      }
    });

    // 5. Get statistics
    console.log('\n📊 Database Statistics:');
    const stats = {
      users: db.prepare('SELECT COUNT(*) as count FROM users').get(),
      roles: db.prepare('SELECT COUNT(*) as count FROM roles').get(),
      dataSources: db.prepare('SELECT COUNT(*) as count FROM data_sources').get(),
      queries: db.prepare('SELECT COUNT(*) as count FROM saved_queries').get(),
    };

    console.log(`  Users: ${stats.users.count}`);
    console.log(`  Roles: ${stats.roles.count}`);
    console.log(`  Data Sources: ${stats.dataSources.count}`);
    console.log(`  Saved Queries: ${stats.queries.count}`);

    db.close();
    console.log('\n✅ Test data seeding completed successfully!');
    console.log('\n🧪 Test Credentials:');
    console.log('  Admin: admin@example.com / admin123');
    console.log('  Analyst: analyst@example.com / analyst123');
    console.log('  Viewer: viewer@example.com / viewer123');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding database:', error.message);
    process.exit(1);
  }
}

seedDatabase();
