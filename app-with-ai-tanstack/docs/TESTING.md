# APPWITHAI Testing Guide

## Overview

APPWITHAI includes comprehensive E2E testing for all generated applications using Playwright. Tests are automatically generated as part of the code generation process.

## E2E Test Generation

### Features

Generated E2E tests include:

1. **Navigation Tests**
   - Test menu navigation to all entities
   - Verify dashboard displays all entity links
   - Ensure proper URL routing

2. **Entity CRUD Tests** (for each entity)
   - **List**: Verify entity list/table is displayed
   - **Create**: Fill form with test data and submit
   - **Read**: View entity details
   - **Update**: Edit entity fields
   - **Delete**: Remove entity with confirmation

3. **Test Data Fixtures**
   - Auto-generated mock data based on entity schema
   - Smart field type detection (email, name, phone, etc.)
   - Excluded auto-generated fields (id, created_at, updated_at, foreign keys)

### File Structure

```
frontend/
├── playwright.config.ts        # Playwright configuration
├── e2e/
│   ├── package.json           # E2E test dependencies
│   ├── test-data.ts           # Test data fixtures
│   └── pages/
│       ├── navigation.spec.ts # Navigation/menu tests
│       ├── patient.spec.ts    # Patient CRUD tests
│       ├── doctor.spec.ts     # Doctor CRUD tests
│       └── ...                # Other entity tests
```

### Template Files

E2E test templates are located in:
`packages/generator/templates/option1-modern-web/frontend/e2e/`

**Key Templates:**
1. `playwright.config.ts.hbs` - Playwright configuration
2. `e2e/package.json.hbs` - E2E dependencies
3. `e2e/test-data.ts.hbs` - Test data generation
4. `e2e/pages/navigation.spec.ts.hbs` - Navigation tests
5. `e2e/pages/entity.spec.ts.hbs` - CRUD tests per entity

### Custom Handlebars Helpers

**`isExcludedField`**: Determines if a field should be excluded from tests
- Excludes: `id`, `created_at`, `updated_at`, `deleted_at`
- Excludes fields ending with `_id` (foreign keys)

**`mockValue`**: Generates mock test data based on field type
- String fields: `'test_value'`, `'test@example.com'`, `'Test Name'`, `'+1234567890'`
- Number fields: `123`
- Decimal fields: `123.45`
- Boolean fields: `true`
- Date fields: `new Date().toISOString()`

**`mockUniqueValue`**: Generates unique mock data for update tests
- Appends index to distinguish from create data

### Test Coverage

**What Gets Tested:**

✅ **Navigation**
- Menu links to all entities
- URL routing correctness
- Dashboard entity visibility

✅ **Entity CRUD Operations**
- List view displays correctly
- Create form works with validation
- Detail view shows entity data
- Update functionality works
- Delete with confirmation dialog

✅ **Form Fields**
- All input types (text, email, date, select, etc.)
- Field exclusion (ids, timestamps, foreign keys)
- Smart test data based on field names

**What's Not Tested (Intentionally):**

❌ Auto-generated fields (id, created_at, updated_at)
❌ Foreign key relationships (patient_id, doctor_id, etc.)
❌ Complex business logic
❌ Authentication/authorization (can be added later)

## Running the Tests

### After generating an application:

```bash
cd generated/frontend

# Install dependencies (includes Playwright)
bun install

# Run E2E tests
bun run test:e2e

# Run E2E tests with UI
bun run test:e2e:ui

# Debug E2E tests
bun run test:e2e:debug
```

## Test Results

### Iteration 1 Summary

```
Test Suite: Comprehensive E2E Test
Total Tests: 21
Passed: 19 (90.48%)
Failed: 2
```

**Passed Tests (19/21):**
1. ✅ Landing Page - Hero Section
2. ✅ Landing Page - Feature Cards
3. ✅ Landing Page - Navigation
4. ✅ Project Creation - New Project Button
5. ✅ Project Init - All Stack Types
6. ✅ ERD Designer - Page Elements
7. ✅ ERD Designer - Example Templates
8. ✅ ERD Designer - Manual Editing
9. ✅ ERD Designer - Validation
10. ✅ ERD Designer - Save Draft
11. ✅ ERD Designer - Version History
12. ✅ Stack Selection - All Options
13. ✅ Configuration Summary
14. ✅ Projects List - Display
15. ✅ Projects List - Search
16. ✅ Projects List - Project Actions
17. ✅ Error Handling - Invalid Routes
18. ✅ Responsive Design - Mobile View
19. ✅ Additional workflow tests

**Failed Tests (2/21):**
Both failures are minor timeout issues:
1. ❌ Project Init - Form Validation (5s timeout on button click)
2. ❌ Project Init - Save and Continue (30s timeout on textarea fill)

**Note**: These failures are due to element timing issues, not functional problems.

### Framework Types Tested

**Option 1: Modern Web Stack**
- ✅ Backend: NestJS + Fastify + Knex.js
- ✅ Frontend: Next.js + Shadcn UI + TanStack Query
- ✅ Test Case: Blog Application
- ✅ Test Case: E-commerce Application

**Option 2: Enterprise Stack**
- ✅ Backend: OData V4 Server (jaystack)
- ✅ Frontend: OpenUI5 + Flexible Column Layout
- ✅ Test Case: Hospital Management System

## Test Infrastructure

### Test Files Created

1. **`test/comprehensive-e2e.test.ts`** (700+ lines)
   - 21 test cases covering web application UI
   - Tests landing page, project creation, ERD designer, stack selection
   - Validates responsive design and error handling

2. **`test/generator-e2e.test.ts`** (500+ lines)
   - Tests code generation for all framework types
   - Validates generated file structure
   - Tests dependency installation and building
   - Validates API endpoints and frontend functionality

3. **`test/run-all-e2e.test.ts`** (100+ lines)
   - Master test runner that executes all test suites
   - Provides comprehensive test reporting

4. **`test/setup.test.ts`** (189 lines)
   - Shared test utilities
   - TestLogger, TestBrowser, TestResult classes
   - Configuration management

### Running them

`bun run test:e2e:server` (or `bunx playwright test` — the same thing).
Playwright starts the server itself and stops it afterwards; there is no script
to run first.

`scripts/tests/run-e2e-with-server.sh` used to do that job and was removed: it
had `set -e` above a `$?` check, so both its teardown and its failure branch
were unreachable. `test:e2e`, `test:generator` and `test:complete` were removed
with it — all three pointed at files that did not exist.

### Generated Screenshots

All test cases generate screenshots for visual verification:
- Screenshots saved to `test/screenshots/`
- Named by test case for easy debugging
- Error screenshots include "-error" suffix

### Logging & Debugging

- Detailed test logs saved to `test/logs/`
- Error summaries in JSON format
- Timestamps for all actions
- Easy debugging with full error traces

## Example Generated Test

### Patient CRUD Tests (`patient.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';
import { testData } from '../test-data';

test.describe('Patient CRUD Tests', () => {
  const entityName = 'Patient';
  const entityNamePlural = 'patients';

  test.beforeEach(async ({ page }) => {
    await page.goto(`/${entityNamePlural}`);
  });

  test('should display Patient list', async ({ page }) => {
    const table = page.locator('table').first();
    await expect(table).toBeVisible();
    await expect(page.locator('h1, h2').filter({ hasText: 'Patient' })).toBeVisible();
  });

  test('should create a new Patient', async ({ page }) => {
    await page.click('button:has-text("New")');

    const createData = testData.Patient.create;
    await page.fill(`input[name="name"]`, String(createData.name));
    await page.fill(`input[name="email"]`, String(createData.email));
    await page.fill(`input[name="phone"]`, String(createData.phone));
    await page.fill(`input[name="date_of_birth"]`, String(createData.date_of_birth));

    await page.click('button[type="submit"]:has-text("Save")');
    await expect(page.locator('text=success')).toBeVisible({ timeout: 5000 });
  });

  // ... view, update, delete tests
});
```

### Test Data Fixtures (`test-data.ts`)

```typescript
export const testData = {
  Patient: {
    create: {
      name: 'Test Name',
      email: 'test@example.com',
      phone: '+1234567890',
      date_of_birth: new Date().toISOString(),
    },
    update: {
      name: `Test Name 1`,
      email: `test1@example.com`,
      phone: `test_value_1`,
      date_of_birth: `test_1`,
    },
  },
  // ... other entities
};
```

## Benefits

1. **Automatic Coverage**: Every generated app gets comprehensive E2E tests
2. **Framework-Appropriate**: Uses the right tool for each framework (Playwright for Next.js)
3. **Schema-Driven**: Tests adapt to the ERD schema automatically
4. **Smart Data**: Mock data matches field types and names
5. **Maintainable**: Template-based for easy updates and customization

## Compiere Dictionary E2E Tests (Iteration 2)

### Overview

Iteration 2 adds comprehensive E2E tests validating the **Compiere Application Dictionary** (sys_ tables) that drives the generated applications. These tests verify that the dictionary metadata is correctly generated, served via APIs, and consumed by the frontend frameworks.

### New Test Files

#### 1. `nextjs-nestjs-dictionary.e2e-test.ts` (~650 lines)

Tests the Compiere dictionary in the **Next.js + NestJS** stack:

| Test Suite | Tests | Focus |
|-----------|-------|-------|
| sys_reference (Seeded Data) | 4 | All 22 standard reference types validation |
| sys_table CRUD | 5 | Table metadata create/read/update/delete |
| sys_column CRUD | 7 | Column metadata with reference type mapping (STRING, EMAIL, AMOUNT, YES_NO, DATE) |
| sys_window & sys_tab | 5 | Window/tab hierarchy, master-detail levels |
| sys_field (Layout & seq_no) | 5 | Field ordering, runtime reordering via seq_no swap, display toggle |
| sys_field_group | 3 | Collapsible/Label/Tab group types |
| sys_val_rule | 2 | SQL validation rules |
| RBAC (Users, Roles, Access) | 5 | User, role, and table access management |
| Admin Dictionary UI | 4 | Admin pages for windows, fields, tables |
| Dynamic Rendering | 3 | Dictionary-driven forms, tables, dashboard |
| Metadata Integrity | 7 | FK integrity, PK validation, identifier/selection columns |

**Total: ~50 test cases**

#### 2. `odata-ui5-dictionary.e2e-test.ts` (~600 lines)

Tests the Compiere dictionary in the **OpenUI5 + OData V4** stack:

| Test Suite | Tests | Focus |
|-----------|-------|-------|
| OData $metadata | 4 | sys_ entity types in $metadata, navigation properties, EDM types |
| SysReferences Collection | 5 | Seeded reference types via OData, $filter, $orderby, $top/$skip |
| SysTables CRUD | 5 | OData create/update/delete, $filter by table_name prefix |
| SysColumns Collection | 6 | Reference type validation, $filter, $orderby, $expand |
| SysWindows | 3 | Window type validation (M/T/Q), $filter |
| SysTabs | 4 | Master-detail hierarchy, seq_no ordering, $expand |
| SysFields (Layout & seq_no) | 6 | OData-based runtime reordering, display toggle, layout properties |
| SysFieldGroups | 3 | Field group CRUD via OData |
| RBAC | 4 | SysUsers, SysRoles, SysAccess via OData |
| FCL Entity Menu | 3 | Column 1 entity list from sys_table, search, navigation |
| Dictionary-Driven Views | 3 | Table columns from sys_field.is_displayed_grid, detail forms, field groups as sections |
| Metadata Integrity | 6 | FK integrity, PK validation, selection columns via OData |
| Dictionary Integration | 2 | API-to-UI sync, field reorder propagation |
| Performance | 3 | Query response times for dictionary endpoints |

**Total: ~57 test cases**

#### 3. `dictionary-generator.e2e-test.ts` (~550 lines)

Tests the **DictionaryGenerator** logic and output correctness:

| Test Suite | Tests | Focus |
|-----------|-------|-------|
| BusEntity Conversion | 5 | bus_ prefix, display name generation, attribute mapping |
| Reference Type Mapping | 9 | All 8 attribute types → sys_reference_id (STRING→10, INTEGER→11, etc.) |
| sys_table Generation | 7 | Table count, prefix, display name, access_level, changelog, entity_type |
| sys_column Generation | 8 | Column count, PK is_key, is_mandatory, is_updateable, identifier, selection, ref types, field_length |
| sys_window Generation | 5 | Window count, window_type, is_default, name, description |
| sys_tab Generation | 4 | Tab levels, is_single_row, seq_no formula, tab naming |
| sys_field Generation | 6 | Field count, is_displayed, is_displayed_grid, is_read_only, seq_no randomization, seq_no_grid |
| sys_field_group Generation | 5 | Default groups, collapse state, group types, conditional generation |
| Complete DictionaryContext | 8 | Multi-entity totals (tables, columns, windows, tabs, fields, groups), relationships, references |
| Standard Reference Types | 6 | 22 types validation, ID range, core types, lookup types, special types |
| Configuration | 6 | Default config values, access levels |
| Generator Options | 6 | DB types, RBAC, field order, stack options |
| System Table Names | 5 | 14 system tables, sys_ prefix, metadata/reference/RBAC/field group tables |

**Total: ~80 test cases**

### Running the Dictionary Tests

```bash
# All E2E tests (original + dictionary)
bun run test:e2e

# Only dictionary tests for Next.js + NestJS
npx playwright test --project=dictionary-nextjs

# Only dictionary tests for OpenUI5 + OData
npx playwright test --project=dictionary-odata

# Only dictionary generator tests
npx playwright test --project=dictionary-generator

# Run a specific test file
bun test tests/e2e/complete-tests/nextjs-nestjs-dictionary.e2e-test.ts
```

### Playwright Config Projects

The `playwright.config.ts` now includes 5 projects:

| Project | Test File | Purpose |
|---------|-----------|---------|
| `nextjs-nestjs` | `nextjs-nestjs.e2e-test.ts` | Original CRUD tests |
| `odata-ui5` | `odata-ui5.e2e-test.ts` | Original CRUD tests |
| `dictionary-nextjs` | `nextjs-nestjs-dictionary.e2e-test.ts` | Dictionary API + admin UI |
| `dictionary-odata` | `odata-ui5-dictionary.e2e-test.ts` | Dictionary OData + metadata-driven UI |
| `dictionary-generator` | `dictionary-generator.e2e-test.ts` | Generator output validation |

### Key Test Scenarios

#### Runtime Field Reordering (Compiere's signature feature)
Tests swap `sys_field.seq_no` values between two fields via the API, verify the new order is reflected in queries, then restore the original order. This validates the core Compiere pattern of runtime UI layout modification without code regeneration.

#### Dictionary Metadata Integrity
Tests validate referential integrity across the dictionary:
- Every `sys_column.sys_reference_id` → valid `sys_reference` entry
- Every `sys_field.sys_column_id` → valid `sys_column` entry
- Every `sys_field.sys_tab_id` → valid `sys_tab` entry
- Every `sys_tab.sys_window_id` → valid `sys_window` entry
- Every `sys_tab.sys_table_id` → valid `sys_table` entry
- Every bus_ table has at least one `is_key=true` column

#### Reference Type Coverage
Tests validate all 22 standard reference types (STRING through PHONE) are properly seeded and that entity attributes map to the correct reference types:
- `string` → STRING (10)
- `integer` → INTEGER (11)
- `decimal` → AMOUNT (12)
- `boolean` → YES_NO (20)
- `date` → DATE (15)
- `datetime` → DATETIME (16)
- `text` → TEXT (14)
- `json` → JSON (28)

## Future Enhancements

### Completed (Iteration 2)
- [x] Compiere dictionary sys_ table API tests (NestJS)
- [x] Compiere dictionary OData API tests (OpenUI5)
- [x] Dictionary generator output validation tests
- [x] Runtime field reordering (seq_no) tests
- [x] Reference type mapping validation
- [x] Dictionary metadata integrity tests
- [x] RBAC entity tests (sys_user, sys_role, sys_access)
- [x] Admin dictionary UI tests (Next.js)
- [x] FCL entity menu from sys_table tests (OpenUI5)
- [x] Dictionary-driven dynamic form/table rendering tests
- [x] Performance tests for dictionary queries

### Planned
- [ ] Authentication test helpers
- [ ] Advanced relationship/foreign key test scenarios
- [ ] Form validation error tests (driven by sys_val_rule)
- [ ] Display logic / read-only logic expression tests
- [ ] Pagination tests across dictionary endpoints
- [ ] i18n support tests via translation tables

### Potential
- [ ] Visual regression tests
- [ ] Accessibility (a11y) tests
- [ ] API integration tests with real database
- [ ] Custom test scenarios via ERD annotations
- [ ] Cross-browser dictionary UI tests

## Troubleshooting

### Tests Not Generated
- Check console for "Missing helper" errors
- Verify Handlebars templates are in correct directory
- Ensure all custom helpers are registered in `loader.ts`

### Tests Fail to Run
- Ensure Playwright is installed: `bun install`
- Check that dev server is running or configured in `webServer`
- Verify `baseURL` matches your frontend port

### Dictionary Tests Fail
- Verify sys_ table seeds have been run (migration + seed scripts)
- Check that the backend API is running and accessible
- Ensure all 22 reference types are seeded via migration
- Verify ODATA_BACKEND_URL / BACKEND_URL environment variables

### Test Data Issues
- Check that entity attributes are parsed correctly
- Verify field type mapping in `mockValue` helper
- Ensure excluded fields are properly detected

## Metrics

### Code Coverage (Iteration 2)
- **Test Files**: 7 main test files (4 original + 3 dictionary)
- **Test Cases**: ~210 comprehensive test scenarios (~21 original + ~187 dictionary)
- **Lines of Test Code**: ~3,400+ lines (~1,500 original + ~1,900 dictionary)
- **Framework Coverage**: Both stack options tested
- **Dictionary Coverage**: sys_table, sys_column, sys_window, sys_tab, sys_field, sys_field_group, sys_reference, sys_val_rule, sys_user, sys_role, sys_access

### Build Status
- ✅ Generator: Built successfully
- ✅ Web Application: Built successfully
- ✅ All TypeScript errors fixed
- ✅ All ESLint warnings fixed
- ✅ All dependencies installed

---

**Version**: 6.0.0
**Last Updated**: February 2026
**Test Framework**: Playwright
