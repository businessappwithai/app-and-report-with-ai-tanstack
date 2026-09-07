/**
 * Complete database initialization using bun:sqlite
 * This creates all necessary tables for the Enterprise Reporting System
 */

import Database from 'bun:sqlite';
import { existsSync, mkdirSync } from 'fs';

const DATABASE_PATH = process.env.DATABASE_PATH || '/app/data/config.sqlite';

console.log('========================================');
console.log('Initializing database with bun:sqlite');
console.log('========================================');
console.log(`Database: ${DATABASE_PATH}`);

// Ensure data directory exists
const dataDir = DATABASE_PATH.split('/').slice(0, -1).join('/');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
  console.log(`Created directory: ${dataDir}`);
}

// Open database connection
const db = new Database(DATABASE_PATH);
db.exec('PRAGMA foreign_keys = ON');

// Create all tables
const schema = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  permissions TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- User roles junction table
CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id)
);

-- Data sources table
CREATE TABLE IF NOT EXISTS data_sources (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  description TEXT,
  client_type TEXT NOT NULL,
  connection_config TEXT NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Saved queries table
CREATE TABLE IF NOT EXISTS saved_queries (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  description TEXT,
  data_source_id TEXT REFERENCES data_sources(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  description TEXT,
  query_id TEXT REFERENCES saved_queries(id) ON DELETE SET NULL,
  chart_config TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Filters table
CREATE TABLE IF NOT EXISTS filters (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  filter_type TEXT NOT NULL,
  config TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Data source filter links
CREATE TABLE IF NOT EXISTS data_source_filters (
  data_source_id TEXT REFERENCES data_sources(id) ON DELETE CASCADE,
  filter_id TEXT REFERENCES filters(id) ON DELETE CASCADE,
  PRIMARY KEY (data_source_id, filter_id)
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  description TEXT,
  query_id TEXT REFERENCES saved_queries(id) ON DELETE SET NULL,
  schedule TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Job executions table
CREATE TABLE IF NOT EXISTS job_executions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  job_id TEXT REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  result_path TEXT,
  error_message TEXT,
  executed_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Email templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Error messages table
CREATE TABLE IF NOT EXISTS error_messages (
  id TEXT PRIMARY KEY,
  language TEXT NOT NULL DEFAULT 'en',
  message TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(id, language)
);

-- Metadata entity registry table
CREATE TABLE IF NOT EXISTS metadata_entity_registry (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  data_source_id TEXT REFERENCES data_sources(id) ON DELETE CASCADE,
  entity_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  is_displayable BOOLEAN DEFAULT 1,
  display_name TEXT,
  description TEXT,
  schema_metadata TEXT,
  last_synced_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(data_source_id, entity_name)
);

-- Entity field registry table  
CREATE TABLE IF NOT EXISTS metadata_entity_fields (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  entity_id TEXT REFERENCES metadata_entity_registry(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL,
  is_nullable BOOLEAN DEFAULT 1,
  is_primary_key BOOLEAN DEFAULT 0,
  is_foreign_key BOOLEAN DEFAULT 0,
  foreign_key_reference TEXT,
  display_name TEXT,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_id, field_name)
);

-- Data source entity permissions
CREATE TABLE IF NOT EXISTS data_source_entity_permissions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  data_source_id TEXT REFERENCES data_sources(id) ON DELETE CASCADE,
  role_id TEXT REFERENCES roles(id) ON DELETE CASCADE,
  entity_id TEXT REFERENCES metadata_entity_registry(id) ON DELETE CASCADE,
  can_read BOOLEAN DEFAULT 0,
  can_write BOOLEAN DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(data_source_id, role_id, entity_id)
);

-- Dashboards table
CREATE TABLE IF NOT EXISTS dashboards (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  description TEXT,
  layout_config TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Dashboard widgets table
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  dashboard_id TEXT REFERENCES dashboards(id) ON DELETE CASCADE,
  report_id TEXT REFERENCES reports(id) ON DELETE SET NULL,
  widget_config TEXT NOT NULL,
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 4,
  height INTEGER NOT NULL DEFAULT 3,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Charts table
CREATE TABLE IF NOT EXISTS charts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  description TEXT,
  query_id TEXT REFERENCES saved_queries(id) ON DELETE SET NULL,
  chart_config TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Chart filter links
CREATE TABLE IF NOT EXISTS chart_filters (
  chart_id TEXT REFERENCES charts(id) ON DELETE CASCADE,
  filter_id TEXT REFERENCES filters(id) ON DELETE CASCADE,
  PRIMARY KEY (chart_id, filter_id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  is_read BOOLEAN DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- NL Query history
CREATE TABLE IF NOT EXISTS nl_query_history (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  natural_language_query TEXT NOT NULL,
  generated_query TEXT NOT NULL,
  execution_status TEXT NOT NULL,
  error_message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

console.log('Creating database schema...');
db.exec(schema);
console.log('✓ Database schema created');

// Create a simple admin user if not exists
console.log('Checking for admin user...');
const adminExists = db.query('SELECT 1 FROM users WHERE email = ?').get('admin@admin.com');
if (!adminExists) {
  console.log('Creating default admin user...');
  
  // Simple password hash for demo (in production, use proper bcrypt)
  const passwordHash = 'admin'; // In production, this should be properly hashed
  
  db.query('INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)')
    .get('admin@admin.com', passwordHash, 'Admin');
  
  // Create admin role
  db.query(`INSERT INTO roles (id, name, description, permissions) VALUES 
    ('admin-role', 'Administrator', 'Full system access', '["*"]')`)
    .run();
  
  // Assign admin role to admin user
  const adminUserId = db.query('SELECT id FROM users WHERE email = ?').get('admin@admin.com').id;
  const adminRoleId = db.query('SELECT id FROM roles WHERE name = ?').get('Administrator').id;
  db.query('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').get(adminUserId, adminRoleId);
  
  console.log('✓ Default admin user created (admin@admin.com / admin)');
} else {
  console.log('⊙ Admin user already exists');
}

console.log('========================================');
console.log('Database initialization completed');
console.log('========================================');

// Verify database was created
const tableCount = db.query("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get().count;
console.log(`✓ Database created with ${tableCount} tables`);

// Close database
db.close();

console.log('✓ Database ready');
