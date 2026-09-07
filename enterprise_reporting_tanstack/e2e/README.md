# End-to-End Testing with Playwright

This directory contains comprehensive E2E tests for the Enterprise Reporting System using Playwright.

## Quick Start

```bash
# 1. Setup test data (creates admin user: admin@admin.com / admin)
npm run test:setup

# 2. Run all tests
npm run test:e2e

# Or do both in one command:
npm run test:e2e:all
```

## Test Structure

```
e2e/
├── helpers/
│   └── test-helpers.ts       # Reusable test utilities and helper functions
├── app.spec.ts               # Authentication and general app tests
├── sql-editor.spec.ts        # SQL Editor basic functionality tests
├── sql-editor-advanced.spec.ts  # SQL Editor advanced query tests (NEW!)
├── charts.spec.ts            # Charts management and viewer tests
├── reports.spec.ts           # Reports management tests
├── reports-editor.spec.ts    # Report Editor full functionality tests (NEW!)
├── dashboards.spec.ts        # Dashboards management tests
└── dashboards-editor.spec.ts # Dashboard Editor full functionality tests (NEW!)
```

## Test Coverage

### 1. Authentication (`app.spec.ts`)
- ✅ Login page loads successfully
- ✅ Successful login with valid credentials
- ✅ Failed login with invalid credentials
- ✅ Login validation (empty email, empty password)
- ✅ Logout functionality
- ✅ Protected pages redirect to login
- ✅ No console errors on page load
- ✅ Responsive design tests

### 2. SQL Editor (`sql-editor.spec.ts` & `sql-editor-advanced.spec.ts`)
#### Basic Functionality
- ✅ SQL Editor page loads correctly
- ✅ Select data source and load schema
- ✅ Execute simple SELECT query
- ✅ Validate SQL query
- ✅ Execute complex JOIN query
- ✅ Execute query with aggregations and GROUP BY
- ✅ Execute query with CTE (WITH clause)
- ✅ Save query for later use
- ✅ Toggle Schema Browser panel
- ✅ Toggle Editor panel
- ✅ View query execution logs

#### Error Handling
- ✅ Handle SQL syntax errors
- ✅ Handle missing data source error
- ✅ Validate without data source shows appropriate message

#### Schema Browser
- ✅ Click table to generate SELECT query
- ✅ View schema details

#### Results Table
- ✅ Results table displays data correctly
- ✅ Sort results by clicking column headers

#### Advanced Queries (`sql-editor-advanced.spec.ts`)
- ✅ Execute UNION query
- ✅ Execute query with multiple JOINs (users, orders, products, order_items)
- ✅ Execute subquery in WHERE clause
- ✅ Execute query with CASE statement
- ✅ Execute query with DISTINCT and ORDER BY
- ✅ Execute query with multiple aggregations (COUNT, SUM, AVG, MIN, MAX)
- ✅ Execute query with date functions (DATE, datetime)
- ✅ Execute query with string functions (UPPER, LOWER, SUBSTR)
- ✅ Execute query with NULL handling (COALESCE, CASE WHEN NULL)
- ✅ Execute query with IN clause
- ✅ Execute query with BETWEEN clause
- ✅ Execute query with LIKE pattern matching

#### Performance Tests (`sql-editor-advanced.spec.ts`)
- ✅ Handle large result set efficiently (500+ rows)
- ✅ Rapid execution of multiple queries in sequence

#### Editor Features (`sql-editor-advanced.spec.ts`)
- ✅ Edit SQL query in Monaco editor
- ✅ Clear editor and type new query
- ✅ Validate multiple queries in sequence

#### Real-World Scenarios (`sql-editor-advanced.spec.ts`)
- ✅ Customer order summary with complex aggregations
- ✅ Product sales by category with multiple joins
- ✅ Find users without orders (LEFT JOIN with NULL check)
- ✅ Time-based analytics query (GROUP BY DATE)
- ✅ Navigate through pages of results (pagination)

### 3. Charts Management (`charts.spec.ts`)
#### Chart Management
- ✅ Charts page loads correctly
- ✅ Displays charts list table
- ✅ Create new chart - Bar Chart
- ✅ Create new chart - Line Chart
- ✅ Create new chart - Pie Chart
- ✅ Create new chart - Area Chart
- ✅ Create new chart - Scatter Plot
- ✅ Create new chart - Composed Chart
- ✅ Validation prevents creating chart without name
- ✅ Cancel chart creation
- ✅ View chart details
- ✅ Delete chart
- ✅ Chart type badges are displayed correctly
- ✅ Query status badges are displayed

#### Chart Viewer
- ✅ View chart with data
- ✅ Refresh chart data
- ✅ Export chart functionality
- ✅ Breadcrumb navigation works
- ✅ Configure button navigates to editor

#### Error Handling
- ✅ Handle empty charts list
- ✅ Handle chart not found

### 4. Reports Management (`reports.spec.ts` & `reports-editor.spec.ts`)
#### Report Management (`reports.spec.ts`)
- ✅ Reports page loads correctly
- ✅ Displays reports list table
- ✅ Create new report with query
- ✅ Create new report without query
- ✅ Validation prevents creating report without name
- ✅ Cancel report creation
- ✅ View report details
- ✅ Edit report
- ✅ Delete report
- ✅ Query status badges are displayed correctly

#### Report Editor (`reports.spec.ts` & `reports-editor.spec.ts`)
- ✅ Report editor loads with column configuration
- ✅ Update column header
- ✅ Toggle column visibility
- ✅ Change column formatter (Text, Number, Currency, Percentage, Date, DateTime, Boolean)
- ✅ Delete column from configuration
- ✅ Save report configuration
- ✅ Breadcrumb navigation in editor
- ✅ View report from editor

#### Advanced Editor Features (`reports-editor.spec.ts`)
- ✅ Create report from scratch and configure all columns
- ✅ Configure all column formatters (Text, Number, Currency, Percentage, Date, DateTime, Boolean)
- ✅ Reorder columns using drag and drop
- ✅ Set multiple column properties at once
- ✅ Configure column visibility for all columns
- ✅ Enable sorting for all columns
- ✅ Navigate between tabs in editor
- ✅ Save report configuration multiple times
- ✅ View report after configuration
- ✅ Full workflow: create, configure, view, and delete report


#### Report Viewer
- ✅ View report with data
- ✅ Report displays with proper columns
- ✅ Breadcrumb navigation in viewer

#### Error Handling
- ✅ Handle empty reports list
- ✅ Handle report not found

### 5. Dashboards Management (`dashboards.spec.ts` & `dashboards-editor.spec.ts`)
#### Dashboard Management (`dashboards.spec.ts`)
- ✅ Dashboards page loads correctly
- ✅ Displays dashboards list table
- ✅ Create new private dashboard
- ✅ Create new public dashboard
- ✅ Create dashboard with minimal information
- ✅ Validation prevents creating dashboard without name
- ✅ Cancel dashboard creation
- ✅ View dashboard details
- ✅ Edit dashboard
- ✅ Delete dashboard
- ✅ Visibility badges are displayed correctly (Public/Private)
- ✅ Public badge has globe icon
- ✅ Private badge has lock icon
- ✅ Dashboard description displays correctly

#### Bulk Operations (`dashboards.spec.ts`)
- ✅ Create multiple dashboards

#### Navigation (`dashboards.spec.ts`)
- ✅ Navigate to dashboard and back
- ✅ Breadcrumb navigation on dashboard page

#### Advanced Dashboard Editor (`dashboards-editor.spec.ts`)
- ✅ Create public dashboard with description
- ✅ Create private dashboard
- ✅ Toggle dashboard visibility between public and private
- ✅ Edit dashboard name and description
- ✅ View dashboard after creation
- ✅ Delete dashboard and verify removal
- ✅ Create multiple dashboards with different settings
- ✅ Navigate between dashboard editor and viewer
- ✅ Verify public dashboard has globe icon
- ✅ Verify private dashboard has lock icon
- ✅ Validation prevents empty dashboard name
- ✅ Handle cancel operation gracefully
- ✅ Full dashboard lifecycle: create, edit, view, delete
- ✅ Create dashboard with minimal information

#### Error Handling (`dashboards.spec.ts` & `dashboards-editor.spec.ts`)
- ✅ Handle empty dashboards list
- ✅ Handle dashboard not found


## Running the Tests

### Prerequisites

Make sure your development environment is set up:
```bash
npm install
```

Ensure your database is set up and has sample data:
```bash
npm run db:migrate
npm run db:sample
```

### Run All Tests

```bash
npm run test:e2e
```

### Run Tests in UI Mode (Interactive)

```bash
npm run test:e2e:ui
```

### Run Tests in Headed Mode (Watch Browser)

```bash
npm run test:e2e:headed
```

### Run Tests in Debug Mode

```bash
npm run test:e2e:debug
```

### Run Specific Test File

```bash
npx playwright test sql-editor.spec.ts
```

### Run Tests Matching a Pattern

```bash
# Run all authentication tests
npx playwright test --grep "Authentication"

# Run all chart tests
npx playwright test charts.spec.ts

# Run tests with a specific name
npx playwright test --grep "login"
```

## Test Helpers

The `TestHelpers` class (`helpers/test-helpers.ts`) provides reusable utility functions:

### Authentication
- `login(email, password)` - Login to the application
- `navigateToPage(pageName)` - Navigate to specific pages

### Form Interactions
- `fillByLabel(label, value)` - Fill form fields by label
- `selectDropdown(triggerText, optionText)` - Select dropdown options
- `clickButton(text)` - Click buttons by text

### Assertions & Verification
- `verifyToast(message, type)` - Verify toast notifications
- `verifyTableHasContent(expectedMinRows)` - Verify table has data
- `verifyNoConsoleErrors()` - Check for console errors

### Editor Interactions
- `waitForMonacoEditor()` - Wait for Monaco editor to load
- `typeInMonacoEditor(text, append)` - Type in Monaco editor
- `getMonacoEditorContent()` - Get editor content

### UI Interactions
- `switchTab(tabText)` - Switch between tabs
- `waitForLoading()` - Wait for loading spinners
- `screenshot(name)` - Take screenshots
- `retry(fn, retries, delay)` - Retry operations

## Test Data

Predefined SQL queries are provided in `TEST_QUERIES`:

- `TEST_QUERIES.simple` - Basic SELECT query
- `TEST_QUERIES.join` - Simple JOIN query
- `TEST_QUERIES.complexJoin` - Complex JOIN with GROUP BY and aggregations
- `TEST_QUERIES.aggregation` - Aggregation query with GROUP BY
- `TEST_QUERIES.withSubquery` - CTE (WITH clause) query

## Configuration

Playwright is configured in `playwright.config.ts`:

- **Base URL**: `http://localhost:4050`
- **Test Directory**: `./e2e`
- **Browser**: Chromium (Desktop)
- **Timeout**: Default timeouts
- **Retries**: 2 on CI
- **Screenshots**: On failure
- **Trace**: On first retry
- **Reporter**: HTML

## Screenshots

Screenshots are automatically saved to `screenshots/` directory:
- On test failures
- When `helpers.screenshot()` is called
- For visual regression testing

## Debugging Tips

### 1. Run with UI Mode
```bash
npm run test:e2e:ui
```
Use the UI to:
- Watch tests run in real-time
- Inspect DOM elements
- View network requests
- Time-travel through test execution

### 2. Run in Headed Mode
```bash
npm run test:e2e:headed
```
Watch the browser execute tests live.

### 3. Use Debug Mode
```bash
npm run test:e2e:debug
```
Step through tests with debugger integration.

### 4. Pause Execution
Add `await page.pause()` in your test to pause and inspect state.

### 5. Increase Timeouts
If tests are failing due to timeouts:
```typescript
await expect(element).toBeVisible({ timeout: 10000 });
```

## CI/CD Integration

Tests are configured to run in CI with:
- Automatic server startup
- Reduced parallel workers
- Retry on failure
- HTML report generation

## Best Practices

1. **Use Test Helpers**: Leverage the `TestHelpers` class for common operations
2. **Wait for Elements**: Use explicit waits instead of fixed timeouts
3. **Descriptive Names**: Use clear test names that describe what is being tested
4. **Independent Tests**: Each test should be able to run independently
5. **Clean State**: Tests should clean up after themselves (delete created resources)
6. **Screenshots**: Take screenshots for complex flows and on failures
7. **Assertions**: Use specific assertions for better error messages
8. **Page Objects**: Consider using page objects for complex pages

## Troubleshooting

### Tests Fail with "Data source not found"
- Ensure database migrations are run: `npm run db:migrate`
- Load sample data: `npm run db:sample`

### Tests Fail with "Authentication failed"
- Verify default credentials: `admin@admin.com` / `admin`
- Check if auth system is running

### Monaco Editor Not Found
- Wait for editor to load: `await helpers.waitForMonacoEditor()`
- Increase timeout for slow networks

### Tests Timeout
- Increase timeout in config: `timeout: 30000`
- Use `reuseExistingServer: true` in config
- Ensure dev server is running

## Contributing

When adding new tests:
1. Use the `TestHelpers` class for common operations
2. Group related tests in `describe` blocks
3. Use descriptive test names
4. Add screenshots for visual verification
5. Update this README with new coverage

## Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Test Helpers Reference](./helpers/test-helpers.ts)
- [Project Documentation](../README.md)
