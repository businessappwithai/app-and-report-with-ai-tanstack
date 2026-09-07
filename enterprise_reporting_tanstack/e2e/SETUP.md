# E2E Test Setup Guide

This guide explains how to set up the environment for running End-to-End tests.

## Prerequisites

### 1. Database Setup

The tests require a database with sample data. Run these commands:

```bash
# Run database migrations
npm run db:migrate

# Load sample data (creates test user admin@admin.com / admin)
npm run db:sample
```

### 2. Default Test User

The tests use this default user:
- **Email**: `admin@admin.com`
- **Password**: `admin`

If this user doesn't exist, authentication tests will fail.

### 3. Creating Test User (if needed)

If the sample data script doesn't create the admin user, you can create one manually:

```sql
-- Run this in your SQLite database
INSERT INTO users (id, email, display_name, password_hash, is_active, created_at, updated_at)
VALUES (
  'usr_admin_001',
  'admin@admin.com',
  'Admin User',
  '$2a$10$YourHashedPasswordHere', -- Generate with: bcrypt.hash('admin', 10)
  1,
  datetime('now'),
  datetime('now')
);
```

Or use Node.js to generate the password hash:

```javascript
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('admin', 10);
console.log(hash);
```

## Running Tests

### Start Dev Server First

```bash
# Terminal 1: Start the dev server
npm run dev
```

### Run Tests in Another Terminal

```bash
# Terminal 2: Run tests
npm run test:e2e
```

Or let Playwright start the server automatically (configured in `playwright.config.ts`):

```bash
npm run test:e2e
```

## Test Data Requirements

### For SQL Editor Tests
- At least one active data source
- Sample tables: `users`, `orders`, `products`, etc.

### For Charts/Reports/Dashboards Tests
- Saved queries to link to charts/reports
- Sample data to visualize

## Troubleshooting

### Tests Fail with "Authentication Failed"

**Cause**: Default user doesn't exist in database

**Solution**:
```bash
npm run db:migrate
npm run db:sample
```

### Tests Fail with "No data sources"

**Cause**: No active data sources in database

**Solution**: Create a data source via the UI or API

### Tests Fail with Port Already in Use

**Cause**: Port 4050 is already in use

**Solution**:
```bash
# Kill process on port 4050
lsof -ti:4050 | xargs kill -9

# Or use a different port
PORT=4051 npm run dev
```

### Console Shows 404 Errors

**Cause**: Some assets or API routes don't exist (this is expected and OK for testing)

**Solution**: You can ignore these or add them to a filter

## Creating Custom Test Data

### Add Sample Data to Database

Create a file `tests/setup-data.ts`:

```typescript
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db/config';

async function setupTestData() {
  const db = getDb();

  // Create admin user
  await db('users').insert({
    id: 'usr_admin_001',
    email: 'admin@admin.com',
    display_name: 'Admin User',
    password_hash: bcrypt.hashSync('admin', 10),
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Create test data source
  await db('data_sources').insert({
    id: 'ds_test_001',
    name: 'Test Data Source',
    description: 'SQLite database for testing',
    client_type: 'sqlite3',
    connection_config: JSON.stringify({
      filename: './test.db',
    }),
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  console.log('✅ Test data created');
}

setupTestData().catch(console.error);
```

Run it with:
```bash
tsx tests/setup-data.ts
```

## CI/CD Setup

For GitHub Actions or other CI:

```yaml
- name: Setup Database
  run: |
    npm run db:migrate
    npm run db:sample

- name: Run E2E Tests
  run: npm run test:e2e
```

## Tips for Reliable Tests

1. **Always start with a clean database** for CI tests
2. **Use transactions** for test data (rollback after tests)
3. **Run tests in isolation** where possible
4. **Increase timeouts** for slow machines
5. **Use `test.serial`** for tests that modify shared state

## Getting Help

If tests fail consistently:
1. Check the screenshots in `test-results/` directory
2. Run with `--headed` flag to watch the browser
3. Use `--debug` flag to pause execution
4. Check the HTML report in `playwright-report/index.html`
