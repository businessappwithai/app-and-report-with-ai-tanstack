# Comprehensive Report Testing Guide

**Report ID:** `f1fb39be-83be-427c-a6d2-063a254e5ca4`
**URL:** `http://localhost:4050/reports/editor/f1fb39be-83be-427c-a6d2-063a254e5ca4`
**Test Date:** 2026-01-28

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Test Environment Setup](#test-environment-setup)
3. [General Settings Tab](#general-settings-tab)
4. [Columns Configuration Tab](#columns-configuration-tab)
5. [Filter Configuration Tab](#filter-configuration-tab)
6. [Export Settings Tab](#export-settings-tab)
7. [Preview & Save Testing](#preview--save-testing)
8. [Report Viewer Testing](#report-viewer-testing)
9. [Export Functionality Testing](#export-functionality-testing)
10. [Test Results Checklist](#test-results-checklist)

---

## Prerequisites

### Required Data:
- ✅ Saved SQL queries exist (check `/queries` page)
- ✅ At least one query returns multiple columns
- ✅ Query has mixed data types (text, numbers, dates)
- ✅ Sample data includes NULL values

### Test Data Preparation:
1. Navigate to **SQL Editor** (`/sql-editor`)
2. Ensure these queries are saved:
   - `Top 10 Actors by Film Count`
   - `Monthly Revenue Summary`
   - `Film Inventory by Category`
3. Run each query to verify they work

---

## Test Environment Setup

### 1. Access Report Editor
```
URL: http://localhost:4050/reports/editor/f1fb39be-83be-427c-a6d2-063a254e5ca4
```

**Expected:**
- Page loads without errors
- All tabs visible: General, Columns, Filters, Export
- Report name loaded in header
- Preview button visible in top right
- Save button visible in top right

**Browser Console:** No errors (ignore `content_script.js` errors - these are from browser extension)

---

## 1. General Settings Tab

### Test Case 1.1: Load Existing Report
**Steps:**
1. Observe the "Name" field
2. Observe the "Data Source Query" dropdown
3. Observe the "Description" field

**Expected Results:**
- [ ] Report name is pre-filled
- [ ] Data source query dropdown shows available queries
- [ ] Currently selected query is highlighted
- [ ] Description field shows existing description (or empty)

### Test Case 1.2: Change Data Source Query
**Steps:**
1. Click "Data Source Query" dropdown
2. Select a different query (e.g., "Top 10 Actors by Film Count")
3. Wait 2-3 seconds
4. Navigate to "Columns" tab

**Expected Results:**
- [ ] Dropdown shows all saved queries
- [ ] Query can be changed
- [ ] System automatically executes query to get columns
- [ ] Available fields populate for column configuration

### Test Case 1.3: Update Report Name
**Steps:**
1. Change "Name" field to "Test Report - [Date]"
2. Click Save button
3. Observe toast message

**Expected Results:**
- [ ] Name field accepts text input
- [ ] Save button shows "Saving..." during save
- [ ] Success toast appears: "Report saved successfully"
- [ ] Name persists after page refresh

### Test Case 1.4: Update Description
**Steps:**
1. Enter description: "Test report for comprehensive filter validation"
2. Save report
3. Refresh page

**Expected Results:**
- [ ] Description field accepts multi-line text
- [ ] Description persists after refresh
- [ ] Special characters accepted

---

## 2. Columns Configuration Tab

### Test Case 2.1: View Available Fields
**Steps:**
1. Select a data source query in General tab (if not already selected)
2. Navigate to Columns tab
3. Click "Add Column" button
4. Observe the "Field" dropdown in the new row

**Expected Results:**
- [ ] "Field" column shows a dropdown (not plain text)
- [ ] Dropdown contains all columns from the SQL query result
- [ ] Fields are named correctly (e.g., first_name, last_name, film_count)
- [ ] At least one field is available

### Test Case 2.2: Add New Column
**Steps:**
1. Click "Add Column" button
2. Click the Field dropdown
3. Select a field (e.g., "first_name")
4. Enter "First Name" in Header field
5. Set Width to "150"
6. Ensure Visible is ON
7. Ensure Sortable is ON
8. Ensure Filterable is ON
9. Set Format to "Text"

**Expected Results:**
- [ ] New row appears at bottom of table
- [ ] All inputs are editable
- [ ] Drag handle (grip icon) appears on left
- [ ] Delete button (trash icon) appears on right

### Test Case 2.3: Configure Column Formats
**Steps:**
1. Add a column with a number field (e.g., "film_count")
2. Set Format to "Number"
3. Add a column with a date field
4. Set Format to "Date"
5. Add a column with price/currency
6. Set Format to "Currency"

**Expected Results:**
- [ ] Format dropdown shows all options: Text, Number, Currency, Percentage, Date, DateTime, Boolean
- [ ] Format selection persists
- [ ] Correct formats available for each field type

### Test Case 2.4: Reorder Columns (Drag & Drop)
**Steps:**
1. Add 3+ columns
2. Drag the grip icon of the second row
3. Drop it onto the first row
4. Observe the order

**Expected Results:**
- [ ] Drag handle is responsive
- [ ] Visual feedback during drag
- [ ] Columns reorder correctly
- [ ] Order persists after save

### Test Case 2.5: Toggle Column Visibility
**Steps:**
1. Turn OFF "Visible" toggle for a column
2. Click Preview button
3. Observe the report viewer
4. Return to editor
5. Turn ON "Visible" again

**Expected Results:**
- [ ] Toggle works smoothly
- [ ] Column disappears from preview when OFF
- [ ] Column reappears when ON
- [ ] Other columns maintain their positions

### Test Case 2.6: Delete Column
**Steps:**
1. Add a test column
2. Click the Trash icon
3. Observe the table

**Expected Results:**
- [ ] Column is removed immediately
- [ ] No confirmation needed (quick deletion)
- [ ] Other columns remain intact

### Test Case 2.7: Column Width Configuration
**Steps:**
1. Set different widths for columns (100, 150, 200, Auto)
2. Save and preview
3. Observe column widths in viewer

**Expected Results:**
- [ ] Width input accepts numbers
- [ ] "Auto" placeholder when empty
- [ ] Column widths respected in preview
- [ ] Responsive layout maintained

---

## 3. Filter Configuration Tab

### Test Case 3.1: Access Filter Builder
**Steps:**
1. Ensure a data source query is selected
2. Navigate to Filters tab

**Expected Results:**
- [ ] Filter Configuration header visible
- [ ] Description text: "Define filter conditions..."
- [ ] If no query selected: "No fields available" message
- [ ] If query selected: Filter builder with "Add Condition" button
- [ ] Filter group shows "AND" logic dropdown

### Test Case 3.2: Add Equals Filter
**Steps:**
1. Click "Add Condition" button
2. Select field from first dropdown (e.g., "rating")
3. Select operator: "Equals"
4. Enter value: "PG-13"
5. Observe the condition

**Expected Results:**
- [ ] New condition row appears
- [ ] Three inputs visible: Field dropdown, Operator dropdown, Value input
- [ ] Delete button (X) visible
- [ ] Background is styled (gray/muted)

### Test Case 3.3: Text Field Operators
**For a text field (e.g., "title", "description", "name"):**

**Test each operator:**

| Operator | Test Input | Expected Behavior |
|----------|------------|-------------------|
| Equals | "Action" | Matches exact string |
| Not Equals | "Comedy" | Excludes exact string |
| Contains | "the" | Finds partial matches |
| Does Not Contain | "xxx" | Excludes containing value |
| Starts With | "A" | Begins with character(s) |
| Ends With | "e" | Ends with character(s) |
| Is Empty | (no input) | No value needed, checks NULL/empty |
| Is Not Empty | (no input) | No value needed, checks NOT NULL |
| In (comma separated) | "PG, PG-13, R" | Matches any in list |
| Not In (comma separated) | "NC-17, XXX" | Excludes any in list |

**For each test:**
- [ ] Operator changes based on field type
- [ ] Value input appears/disappears appropriately
- [ ] Operator labels are clear
- [ ] Value placeholder shows appropriate text

### Test Case 3.4: Number Field Operators
**For a number field (e.g., "film_count", "length", "amount"):**

**Test each operator:**

| Operator | Test Input | Expected Behavior |
|----------|------------|-------------------|
| Equals | "100" | Exact number match |
| Not Equals | "50" | Excludes exact number |
| Greater Than | "5" | Numbers > value |
| Less Than | "200" | Numbers < value |
| Between | "10" and "50" | Range (inclusive) |
| Is Null | (no input) | Checks NULL |
| Is Not Null | (no input) | Checks NOT NULL |

**For "Between" operator:**
- [ ] Two value inputs appear
- [ ] Labels show "From" and "To"
- [ ] "to" separator visible between inputs
- [ ] Both inputs are required

### Test Case 3.5: Date Field Operators
**For a date field (e.g., "created_at", "payment_date", "release_date"):**

**Test each operator:**

| Operator | Test Input | Expected Behavior |
|----------|------------|-------------------|
| Equals | "2026-01-28" | Exact date match |
| Before | "2026-01-01" | Dates before value |
| After | "2026-01-01" | Dates after value |
| Between | Start and End dates | Date range |
| Is Null | (no input) | Checks NULL |
| Is Not Null | (no input) | Checks NOT NULL |

**For "Between" operator:**
- [ ] Two date inputs appear
- [ ] Date picker or text input works
- [ ] Range logic correct

### Test Case 3.6: Boolean Field Operators
**For a boolean field (e.g., "active", "is_deleted", "has_special"):**

**Test each operator:**

| Operator | Test Input | Expected Behavior |
|----------|------------|-------------------|
| Is True | (no input) | Field = true |
| Is False | (no input) | Field = false |

**Expected:**
- [ ] No value input needed
- [ ] Only two operators available
- [ ] Clear labels

### Test Case 3.7: Multiple Conditions with AND Logic
**Steps:**
1. Add condition 1: "rating" Equals "PG"
2. Add condition 2: "film_count" Greater Than "10"
3. Ensure Logic dropdown shows "AND"
4. Save report
5. Preview report

**Expected Results:**
- [ ] Multiple conditions appear
- [ ] All conditions shown in one group
- [ ] Logic dropdown shows "AND"
- [ ] Preview filters correctly (both conditions must match)
- [ ] Filter summary visible in preview

### Test Case 3.8: Change Logic to OR
**Steps:**
1. With multiple conditions
2. Change Logic dropdown from "AND" to "OR"
3. Observe
4. Save and preview

**Expected Results:**
- [ ] Dropdown switches smoothly
- [ ] Logic label updates
- [ ] Preview uses OR logic (either condition can match)
- [ ] Different results than AND logic

### Test Case 3.9: Remove Filter Condition
**Steps:**
1. Add multiple conditions
2. Click X button on one condition
3. Observe

**Expected Results:**
- [ ] Condition removed immediately
- [ ] Other conditions remain
- [ ] No confirmation needed

### Test Case 3.10: Complex Filter Scenarios

**Scenario A: E-commerce Product Filter**
- Category Equals "Electronics"
- Price Between "100" and "500"
- Stock Greater Than "0"
- Is Active Is True

**Test:**
- [ ] All conditions added successfully
- [ ] Preview shows correct filtering
- [ ] Performance is good

**Scenario B: Date Range Filter**
- Created Date After "2026-01-01"
- Created Date Before "2026-12-31"
- Status Not In "cancelled", "refunded"

**Test:**
- [ ] Date range works correctly
- [ ] Not In operator with comma-separated values works
- [ ] Combined filters work

**Scenario C: Text Search Filter**
- Title Contains "report"
- Description Not Contains "test"
- Name Starts With "admin"

**Test:**
- [ ] Text operators work correctly
- [ ] Case sensitivity (should be case-insensitive)
- [ ] Partial matches work

### Test Case 3.11: Filter with No Conditions
**Steps:**
1. Navigate to Filters tab
2. Don't add any conditions (empty state)

**Expected Results:**
- [ ] Shows "Add Condition" button
- [ ] Message about no filters configured
- [ ] Can still save report
- [ ] Preview shows all data (no filtering)

---

## 4. Export Settings Tab

### Test Case 4.1: View Export Options
**Steps:**
1. Navigate to Export tab

**Expected Results:**
- [ ] Three export options visible:
  - CSV Export
  - Excel Export
  - PDF Export
- [ ] Each option has a toggle switch
- [ ] Each option has a description
- [ ] Note at bottom explains behavior

### Test Case 4.2: Toggle Export Formats
**Steps:**
1. Turn OFF CSV Export
2. Turn OFF Excel Export
3. Turn ON PDF Export
4. Save report
5. Click Preview

**Expected Results:**
- [ ] Toggles work smoothly
- [ ] Only enabled export buttons show in preview
- [ ] If all OFF: no export buttons visible
- [ ] If all ON: all three export buttons visible
- [ ] Settings persist after refresh

### Test Case 4.3: Export Button Labels in Preview
**Steps:**
1. Enable CSV and Excel
2. Disable PDF
3. Save and Preview
4. Observe report header

**Expected Results:**
- [ ] "Export CSV" button visible
- [ ] "Export Excel" button visible
- [ ] No PDF export button
- [ ] Buttons are in header area
- [ ] Buttons are clickable

### Test Case 4.4: Export Description Text

**Verify descriptions:**
- [ ] CSV: "Comma-separated values format, compatible with Excel and other tools"
- [ ] Excel: "Native Excel format with formatting and formulas preserved"
- [ ] PDF: "Portable Document Format, ideal for printing and sharing"

---

## 5. Preview & Save Testing

### Test Case 5.1: Preview Button Accessibility
**Steps:**
1. Observe the top-right header area
2. Click "Preview" button (Eye icon)

**Expected Results:**
- [ ] Preview button always visible
- [ ] Can click anytime (even without saving)
- [ ] Opens report viewer in new tab or same tab
- [ ] URL: `/reports/viewer/[report-id]`

### Test Case 5.2: Preview Without Saving
**Steps:**
1. Make changes (add column, add filter)
2. DO NOT click Save
3. Click Preview
4. Observe the preview

**Expected Results:**
- [ ] Preview shows latest changes
- [ ] Works even if report not saved
- [ ] Warning message may appear ("unsaved changes")
- [ ] Preview reflects current editor state

### Test Case 5.3: Save Report
**Steps:**
1. Make changes to all tabs:
   - General: Update name/description
   - Columns: Add/modify columns
   - Filters: Add filter conditions
   - Export: Toggle export formats
2. Click "Save" button
3. Observe button state
4. Observe toast message

**Expected Results:**
- [ ] Save button always accessible
- [ ] Button shows "Saving..." during save
- [ ] Button returns to "Save" after completion
- [ ] Success toast: "Report saved successfully"
- [ ] No errors in console

### Test Case 5.4: Save Persistence
**Steps:**
1. Configure report with specific settings
2. Save report
3. Refresh page (F5)
4. Verify all settings

**Expected Results:**
- [ ] General settings persist (name, description, query)
- [ ] All columns persist with correct order
- [ ] Column configurations persist (width, format, visibility, etc.)
- [ ] All filter conditions persist
- [ ] Filter logic (AND/OR) persists
- [ ] Export format selections persist

### Test Case 5.5: Save Validation
**Steps:**
1. Clear the report name
2. Try to save

**Expected Results:**
- [ ] Validation error or warning
- [ ] Report name is required
- [ ] Cannot save with empty name

---

## 6. Report Viewer Testing

### Test Case 6.1: Load Report in Viewer
**URL:** `http://localhost:4050/reports/viewer/f1fb39be-83be-427c-a6d2-063a254e5ca4`

**Steps:**
1. Navigate to viewer URL
2. Observe page load

**Expected Results:**
- [ ] Report header visible
- [ ] Report title displayed
- [ ] Description displayed (if any)
- [ ] Data table visible
- [ ] Export buttons visible (based on settings)
- [ ] Filter controls visible (if configured)
- [ ] No console errors

### Test Case 6.2: Column Display
**Steps:**
1. Check table headers
2. Verify column order
3. Verify visibility settings
4. Check column widths

**Expected Results:**
- [ ] Headers match configured Header values
- [ ] Columns in correct order (from editor)
- [ ] Hidden columns don't appear
- [ ] Visible columns appear
- [ ] Widths respected

### Test Case 6.3: Table Data Display
**Steps:**
1. Observe data rows
2. Check formatting:
   - Numbers formatted correctly
   - Currency shows $ symbol
   - Dates formatted correctly
   - Booleans show as badges or icons
   - Text fields display properly

**Expected Results:**
- [ ] Data loads successfully
- [ ] At least 10 rows visible (or paginated)
- [ ] Formatted values match configuration
- [ ] No data truncation
- [ ] Overflow handled (scroll or virtual scrolling)

### Test Case 6.4: Sorting
**Steps:**
1. Click on a sortable column header
2. Click again to reverse sort
3. Try multiple columns

**Expected Results:**
- [ ] Sortable columns show arrow indicator
- [ ] First click: ascending (↑)
- [ ] Second click: descending (↓)
- [ ] Non-sortable columns don't respond
- [ ] Sort persists during navigation
- [ ] Visual feedback on active sort

### Test Case 6.5: Filtering in Viewer
**Steps:**
1. Look for filter controls (if configured)
2. Enter filter values
3. Apply filter
4. Observe results

**Expected Results:**
- [ ] Filter controls visible for each configured filter
- [ ] Field labels match filter configuration
- [ ] Operator labels match configuration
- [ ] Value inputs accept data
- [ ] Filter button/Apply button works
- [ ] Results update to match filter
- [ ] Filter state visible (active filters shown)
- [ ] Clear filter button available

### Test Case 6.6: Pagination
**Steps:**
1. Check if pagination exists
2. Navigate pages
3. Check page size

**Expected Results:**
- [ ] Pagination controls visible (if data > page size)
- [ ] Current page highlighted
- [ ] "Previous" and "Next" buttons work
- [ ] Page numbers correct
- [ ] Page size selector (if available)
- [ ] Total row count displayed

---

## 7. Export Functionality Testing

### Test Case 7.1: CSV Export
**Steps:**
1. Enable CSV export in settings
2. Save report
3. Open report viewer
4. Click "Export CSV" button
5. Observe download

**Expected Results:**
- [ ] Button triggers download
- [ ] File downloads with `.csv` extension
- [ ] Filename includes report name or timestamp
- [ ] CSV opens correctly in Excel/Numbers
- [ ] Headers present in first row
- [ ] Data properly formatted (quoted if needed)
- [ ] Commas separate values correctly
- [ ] Special characters handled (quotes, newlines)

**CSV Validation:**
```csv
first_name,last_name,film_count
PEGGY,CHAPLIN,35
PENELOPE,GUINESS,42
```

### Test Case 7.2: Excel Export
**Steps:**
1. Enable Excel export
2. Save and open viewer
3. Click "Export Excel" button
4. Open downloaded file in Excel

**Expected Results:**
- [ ] File downloads with `.xlsx` extension
- [ ] File opens in Excel/LibreOffice Calc
- [ ** Headers in first row with styling (bold)
- [ ] Column widths preserved
- [ ] Number formatting preserved
- [ ] Currency symbols present ($)
- [ ] Date formatting preserved
- [ ] No data corruption
- [ ] Formulas (if any) preserved

### Test Case 7.3: PDF Export
**Steps:**
1. Enable PDF export
2. Save and open viewer
3. Click "Export PDF" button
4. Open downloaded PDF

**Expected Results:**
- [ ] File downloads with `.pdf` extension
- [ ] Opens in PDF viewer/browser
- [ ] Report title visible
- [ ] Table formatted correctly
- [ ] All columns visible
- [ ] Page numbers present
- [ ] Headers repeat on each page
- [ ] Landscape or portrait orientation appropriate
- [ ] Fonts readable
- [ ] Colors/gradients preserved

### Test Case 7.4: Export with Filters Applied
**Steps:**
1. Apply filter in viewer
2. Export data (all formats)
3. Check exported files

**Expected Results:**
- [ ] CSV contains only filtered data
- [ ] Excel contains only filtered data
- [ ] PDF contains only filtered data
- [ ] Row counts match viewer display
- [ ] Headers include filter information

### Test Case 7.5: Export with Large Dataset
**Steps:**
1. Create report with query returning 1000+ rows
2. Export all formats
3. Check file sizes and completeness

**Expected Results:**
- [ ] CSV handles large datasets
- [ ] Excel handles large datasets
- [ ] PDF paginates correctly
- [ ] No data loss
- [ ] Performance acceptable
- [ ] Memory limits not exceeded

---

## 8. Filter Integration Testing

### Test Case 8.1: Filter UI in Viewer
**Steps:**
1. Configure filters in editor (3+ conditions)
2. Save report
3. Open viewer
4. Observe filter section

**Expected Results:**
- [ ] Filter panel visible
- [ ] All configured conditions shown
- [ ] Field labels clear
- [ ] Operator labels clear
- [ ] Value inputs pre-filled (if defaults)
- [ ] "Apply Filters" button
- [ ] "Clear Filters" button

### Test Case 8.2: Apply Single Filter
**Steps:**
1. Set one filter value
2. Click Apply
3. Verify results

**Expected Results:**
- [ ] Results update immediately
- [ ] Loading indicator visible
- [ ] Result count updates
- [ ] Table shows filtered data
- [ ] Filter marked as active

### Test Case 8.3: Apply Multiple Filters (AND)
**Steps:**
1. Set 2-3 filter values
2. Ensure logic is AND
3. Apply filters
4. Verify results

**Expected Results:**
- [ ] All conditions must match
- [ ] Result count smaller than individual filters
- [ ] Correct subset of data shown
- [ ] Performance acceptable

### Test Case 8.4: Apply Multiple Filters (OR)
**Steps:**
1. Change filter logic to OR
2. Set 2-3 filter values
3. Apply filters
4. Verify results

**Expected Results:**
- [ ] Any condition can match
- [ ] Result count larger than AND logic
- [ ] Correct subset of data shown
- [ ] Logic indicator visible

### Test Case 8.5: Clear Filters
**Steps:**
1. Apply filters
2. Click "Clear Filters"
3. Verify results

**Expected Results:**
- [ ] All filter inputs reset
- [ ] Full dataset shown
- [ ] Filter count shows "X of Y"
- [ ] Active filter indicators removed

### Test Case 8.6: Filter with NULL Values
**Steps:**
1. Add "Is Null" or "Is Not Null" filter
2. Apply filter
3. Check results

**Expected Results:**
- [ ] NULL values correctly identified
- [ ] Empty strings handled correctly
- [ ] No errors for NULL comparisons
- [ ] Results accurate

### Test Case 8.7: Filter Performance
**Steps:**
1. Apply complex filters (5+ conditions)
2. Measure response time
3. Check browser performance

**Expected Results:**
- [ ] Response time < 3 seconds
- [ ] No browser freeze
- [ ] No memory leaks
- [ ] UI remains responsive
- [ ] Loading indicator visible

---

## 9. Edge Cases and Error Handling

### Test Case 9.1: No Data Source Query
**Steps:**
1. Create new report
2. Don't select any query
3. Try to configure columns

**Expected Results:**
- [ ] Helpful message shown
- [ ] No errors thrown
- [ ] Cannot add columns
- [ ] Clear instruction to select query

### Test Case 9.2: Query Returns No Data
**Steps:**
1. Select query that returns 0 rows
2. Preview report

**Expected Results:**
- [ ] "No data available" message
- [ ] Column headers still shown
- [ ] Filters still configured
- [ ] No errors thrown

### Test Case 9.3: Query Returns Error
**Steps:**
1. Select query with invalid SQL
2. Preview report

**Expected Results:**
- [ ] Error message displayed
- [ ] Error details shown
- [ ] Suggestion to fix query
- [ ] No crash

### Test Case 9.4: Invalid Filter Values
**Steps:**
1. Enter invalid data in filter:
   - Text in number field
   - Date in wrong format
   - Non-numeric in numeric comparison
2. Apply filter

**Expected Results:**
- [ ] Validation error shown
- [ ] Helpful error message
- [ ] Filter not applied
- [ ] Input highlighted

### Test Case 9.5: Very Long Text Values
**Steps:**
1. Query with very long text values (1000+ chars)
2. Display in table
3. Export

**Expected Results:**
- [ ] Text truncated or wrapped appropriately
- [ ] No layout break
- [ ] Export handles long values
- [ ] Performance acceptable

---

## 10. Test Results Checklist

### General Settings
- [ ] All tests in Section 1 passed

### Columns Configuration
- [ ] All tests in Section 2 passed

### Filter Configuration
- [ ] All tests in Section 3 passed

### Export Settings
- [ ] All tests in Section 4 passed

### Preview & Save
- [ ] All tests in Section 5 passed

### Report Viewer
- [ ] All tests in Section 6 passed

### Export Functionality
- [ ] All tests in Section 7 passed

### Filter Integration
- [ ] All tests in Section 8 passed

### Edge Cases
- [ ] All tests in Section 9 passed

---

## Summary

**Total Test Cases:** 90+
**Test Execution Date:** ___________
**Tester:** ___________
**Overall Result:** PASS / FAIL

**Critical Issues Found:**
1.
2.
3.

**Non-Critical Issues:**
1.
2.

**Recommendations:**
1.
2.

---

## Additional Notes

### Browser Compatibility
- [ ] Chrome/Edge: Tested
- [ ] Firefox: Tested
- [ ] Safari: Tested

### Performance Metrics
- Initial page load: _______ ms
- Filter application: _______ ms
- Export generation: _______ ms
- Large dataset (1000+ rows): _______ ms

### Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Color contrast sufficient
- [ ] Error messages descriptive

---

**End of Test Guide**
