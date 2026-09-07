# Enterprise Reporting System - E2E Test Suite

## Overview

This test suite uses a **numbered batch system** to organize E2E tests into manageable phases. Each phase contains 10 tests, making it easy to run tests in batches and identify failures quickly.

## Quick Start

### Run All Tests in Phases
```bash
npm run test:batches
```
This runs all 6 phases sequentially (tests 1-55). Stops immediately if any phase fails.

### Run Individual Phases
```bash
npm run test:phase1    # Tests 1-5: Authentication & Navigation
npm run test:phase2    # Tests 6-15: Dashboards Management
npm run test:phase3    # Tests 16-25: SQL Editor Basic
npm run test:phase4    # Tests 26-35: SQL Editor Advanced
npm run test:phase5    # Tests 36-45: Reports Management
npm run test:phase6    # Tests 46-55: Charts Management
```

### Run Specific Test Files
```bash
npm run test:app        # Authentication tests only
npm run test:dashboard  # Dashboard tests only
npm run test:sql        # SQL Editor tests only
npm run test:reports    # Reports tests only
npm run test:charts     # Charts tests only
```

### Run Original Test Files
```bash
npm run test:e2e        # All original test files (may have memory issues)
npm run test:e2e:ui     # Interactive test UI
npm run test:e2e:headed # Run tests in visible browser
```

## Test Organization

### Phase 1: Authentication & Navigation (Tests 1-5)
- ✅ 01 - Login page loads successfully
- ✅ 02 - Successful login with valid credentials
- ✅ 03 - Failed login with invalid credentials
- ✅ 04 - Logout functionality works
- ✅ 05 - Dashboard page loads correctly

### Phase 2: Dashboards Management (Tests 6-15)
- 06 - Dashboards page loads correctly
- 07 - Create new private dashboard
- 08 - Create new public dashboard
- 09 - Cancel dashboard creation
- 10 - View dashboard details
- 11 - Edit dashboard
- 12 - Delete dashboard
- 13 - Dashboard visibility badges display correctly
- 14 - Handle empty dashboards list
- 15 - Dashboard navigation breadcrumbs work

### Phase 3: SQL Editor - Basic (Tests 16-25)
- 16 - SQL Editor page loads correctly
- 17 - Select data source and load schema
- 18 - Execute simple SELECT query
- 19 - Validate SQL query
- 20 - Execute complex JOIN query
- 21 - Execute query with aggregations and GROUP BY
- 22 - Execute query with CTE (WITH clause)
- 23 - Save query for later use
- 24 - View query execution logs
- 25 - Handle SQL syntax error gracefully

### Phase 4: SQL Editor - Advanced (Tests 26-35)
- 26 - Execute UNION query
- 27 - Execute query with multiple JOINs
- 28 - Execute subquery in WHERE clause
- 29 - Execute query with CASE statement
- 30 - Execute query with DISTINCT and ORDER BY
- 31 - Execute query with multiple aggregations
- 32 - Execute query with date functions
- 33 - Execute query with string functions
- 34 - Execute query with NULL handling
- 35 - Navigate through pages of results

### Phase 5: Reports Management (Tests 36-45)
- 36 - Reports page loads correctly
- 37 - Create new report with query
- 38 - Create new report without query
- 39 - Validation prevents creating report without name
- 40 - Cancel report creation
- 41 - View report details
- 42 - Edit report
- 43 - Delete report
- 44 - Query status badges are displayed correctly
- 45 - Handle empty reports list

### Phase 6: Charts Management (Tests 46-55)
- 46 - Charts page loads correctly
- 47 - Create new chart - basic bar chart
- 48 - Create new chart - line chart
- 49 - Create new chart - pie chart
- 50 - Create new chart - area chart
- 51 - Create new chart - scatter plot
- 52 - Create new chart - composed chart
- 53 - Cancel chart creation
- 54 - View chart details
- 55 - Delete chart

## Test Results

Results are saved to `playwright-report/index.html`. View them with:
```bash
open playwright-report/index.html  # macOS
xdg-open playwright-report/index.html  # Linux
start playwright-report/index.html  # Windows
```

## CI/CD Integration

### Full Quality Check
```bash
npm run test:ci
```
This runs:
1. Lint check (`npm run lint`)
2. TypeScript type check (`npm run typecheck`)
3. Test setup (`npm run test:setup`)
4. All E2E tests (`npm run test:e2e`)

### Pre-commit Hook
```bash
npm run precommit
```
Runs lint, typecheck, and format check before committing.

## Troubleshooting

### Memory Issues
If you encounter memory issues (exit code 137):
- Use the batch system: `npm run test:phase1`
- Run with single worker: `npx playwright test --workers=1`
- Run specific test files: `npm run test:app`

### Tests Timeout
If tests timeout, check:
1. Is the dev server running? (`npm run dev`)
2. Is the database set up? (`npm run test:setup`)
3. Are credentials correct? (admin@admin.com / admin)

### Authentication Errors
CSRF errors in server logs are expected during login attempts and don't break tests.

## Test Data

The test suite uses a sample SQLite database with:
- 20 tables (users, orders, products, customers, etc.)
- 10,000+ records
- Located at: `/database/sample.db`

To recreate the database:
```bash
npm run db:sample
```

## Adding New Tests

To add a new test to the numbered system:

1. Edit `e2e/test-harness.spec.ts`
2. Find the appropriate batch section
3. Add your test with a number:
```typescript
test('56-Your new test name', async ({ page }) => {
  // Your test code
});
```

## File Structure

```
e2e/
├── test-harness.spec.ts      # Master numbered test suite (use this!)
├── app.spec.ts               # Original authentication tests
├── dashboards.spec.ts        # Original dashboard tests
├── dashboards-editor.spec.ts # Original dashboard editor tests
├── sql-editor.spec.ts        # Original SQL editor tests
├── sql-editor-advanced.spec.ts # Original SQL advanced tests
├── reports.spec.ts           # Original reports tests
├── reports-editor.spec.ts    # Original report editor tests
└── charts.spec.ts            # Original charts tests
```

## Best Practices

1. **Always run tests in batches** - Makes it easier to identify failures
2. **Check test results** - View HTML report after each run
3. **Fix failures before proceeding** - Don't skip failing tests
4. **Use numbered tests** - Makes debugging easier (e.g., "Test 23 failed")
5. **Keep tests independent** - Each test should work in isolation

## Support

For issues or questions:
- Check test screenshots in: `test-results/`
- Check server logs in terminal
- Review authentication flow in: `src/app/(auth)/login/page.tsx`
- Review test helpers in: `e2e/helpers/test-helpers.ts`
