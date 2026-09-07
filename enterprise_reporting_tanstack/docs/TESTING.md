# Testing Guide

Complete E2E testing suite for the Enterprise Reporting System using Playwright.

## Quick Start

### Run All Tests
```bash
bun run test:e2e
```

### Run with UI
```bash
bun run test:e2e:ui
```

### Run Phased Tests (Recommended)
```bash
bun run test:phase1    # Authentication (5 tests)
bun run test:phase2    # Dashboards (10 tests)
bun run test:phase3    # SQL Editor Basic (10 tests)
bun run test:phase4    # SQL Editor Advanced (10 tests)
bun run test:phase5    # Reports (10 tests)
bun run test:phase6    # Charts (10 tests)
```

### Run Feature-Specific Tests
```bash
bun run test:app        # Authentication only
bun run test:dashboard  # Dashboard tests only
bun run test:sql        # SQL Editor only
bun run test:reports    # Reports only
bun run test:charts     # Charts only
```

### CI/CD Pipeline
```bash
bun run test:ci
# Runs: lint → typecheck → test:setup → e2e
```

## Test Organization

### Phase 1: Authentication & Navigation (Tests 1-5)
- 01 - Login page loads
- 02 - Successful login
- 03 - Failed login validation
- 04 - Logout functionality
- 05 - Dashboard navigation

### Phase 2: Dashboards (Tests 6-15)
- 06 - Dashboards page loads
- 07 - Create private dashboard
- 08 - Create public dashboard
- 09 - Cancel dashboard creation
- 10 - View dashboard details
- 11 - Edit dashboard
- 12 - Delete dashboard
- 13 - Visibility badges display
- 14 - Empty dashboards list
- 15 - Navigation breadcrumbs

### Phase 3: SQL Editor - Basic (Tests 16-25)
- 16 - SQL Editor page loads
- 17 - Select data source, load schema
- 18 - Execute simple SELECT
- 19 - Validate SQL query
- 20 - Execute JOIN query
- 21 - Execute aggregation/GROUP BY
- 22 - Execute CTE (WITH clause)
- 23 - Save query
- 24 - View execution logs
- 25 - Handle syntax errors

### Phase 4: SQL Editor - Advanced (Tests 26-35)
- 26 - UNION queries
- 27 - Multiple JOINs
- 28 - Subqueries in WHERE
- 29 - CASE statements
- 30 - DISTINCT and ORDER BY
- 31 - Multiple aggregations
- 32 - Date functions
- 33 - String functions
- 34 - NULL handling
- 35 - Result pagination

### Phase 5: Reports (Tests 36-45)
- 36 - Reports page loads
- 37 - Create report with query
- 38 - Create report without query
- 39 - Validation: name required
- 40 - Cancel report creation
- 41 - View report details
- 42 - Edit report
- 43 - Delete report
- 44 - Query status badges
- 45 - Empty reports list

### Phase 6: Charts (Tests 46-55)
- 46 - Charts page loads
- 47 - Create bar chart
- 48 - Create line chart
- 49 - Create pie chart
- 50 - Create area chart
- 51 - Create scatter plot
- 52 - Create composed chart
- 53 - Cancel chart creation
- 54 - View chart details
- 55 - Delete chart

## Test Results

Results are saved to `playwright-report/index.html`:
```bash
open playwright-report/index.html  # macOS
xdg-open playwright-report/index.html  # Linux
```

## Test Data

The suite uses a sample SQLite database with:
- 20 tables (users, orders, products, customers, etc.)
- 10,000+ records
- Location: `/database/sample.db`

To recreate:
```bash
bun run db:sample
```

## Known Issues & Workarounds

### Monaco Editor in Playwright Tests
**Issue**: Monaco Editor does not render in automated tests
**Workaround**: Manual testing required - see browser console test script
**User Impact**: NONE - Editor works in real browsers

### Test Timeouts
If tests timeout:
1. Ensure dev server is running (`bun run dev`)
2. Verify database is set up (`bun run test:setup`)
3. Check credentials are correct (admin@admin.com / admin)

### Concurrent Test Load
Running all 197 tests with 7 workers may overload dev server:
- Use `--workers=1` for reliable testing
- Run tests in phases: `bun run test:batches`

## Configuration

### Playwright Config
`playwright.config.ts`:
- `timeout: 60000` - Increased from default 30000
- `workers: 1` - Single worker to avoid overload
- `retries: 0` - No retries in development
- `trace: 'on-first-retry'` - Capture traces
- `screenshot: 'only-on-failure'` - Screenshots on failure

## Writing New Tests

### Test Template
```typescript
test('descriptive name', async ({ page }) => {
  // Setup
  await page.goto('/your-page');

  // Action
  await page.click('button');

  // Verification
  await expect(page.getByText('Result')).toBeVisible();
});
```

### Adding to Numbered System
Edit `e2e/test-harness.spec.ts`:
```typescript
test('56-Your new test', async ({ page }) => {
  // Test code
});
```

## Pre-commit Checklist
```bash
bun run precommit   # lint + typecheck + format:check
```

## Debugging

### Check Screenshots
Failed tests save to `test-results/[test-name]/test-failed-1.png`

### Common Issues

| Issue | Solution |
|-------|----------|
| Timeout waiting for element | Increase timeout in helper |
| Element not found | Verify selector, check DOM |
| Test timeout exceeded | Check app responsiveness, increase config timeout |

## Report Testing Guide

See `REPORT_TESTING_GUIDE.md` for comprehensive report testing (90+ test cases covering all tabs, filters, exports).

## Support

For issues:
1. Check test screenshots in `test-results/`
2. Review server logs
3. Verify test helpers in `e2e/helpers/test-helpers.ts`
