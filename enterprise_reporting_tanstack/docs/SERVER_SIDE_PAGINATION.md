# Server-Side Pagination Architecture

## CRITICAL: Server-Side Pagination ONLY

This application uses **strictly server-side pagination**. ALL data fetching must include `LIMIT` and `OFFSET` at the database level. **No client-side pagination is allowed** - fetching all data and paginating in the browser will overload the server.

## Environment Configuration

Pagination is controlled via environment variables in `.env.local`:

```bash
# SERVER-SIDE PAGINATION CONFIGURATION (CRITICAL)
# IMPORTANT: This application uses SERVER-SIDE PAGINATION ONLY
# All data queries MUST include LIMIT and OFFSET at the database level
# DO NOT fetch all data and paginate on the client - this will overload the server

# Default page size for all paginated server queries
DEFAULT_PAGE_SIZE=50

# Maximum page size allowed (user cannot exceed this limit)
MAX_PAGE_SIZE=1000

# Default page size for data tables (server-side fetching)
DATA_TABLE_PAGE_SIZE=100

# Default page size for report exports (server-side batch processing)
EXPORT_PAGE_SIZE=1000

# Virtual scrolling threshold - when to enable virtual scrolling with server-side data fetching
VIRTUAL_SCROLL_THRESHOLD=500

# Enable virtual scrolling for large datasets (works with server-side pagination)
ENABLE_VIRTUAL_SCROLLING=true
```

## How It Works

### 1. API Endpoint (SQL Execute)
```typescript
// Server validates and enforces pagination limits
const effectiveLimit = validatePageSize(limit || paginationConfig.dataTablePageSize);
const effectiveOffset = offset || 0;

// SQL is modified BEFORE execution to include LIMIT and OFFSET
limitedSQL = `${limitedSQL} LIMIT ${effectiveLimit} OFFSET ${effectiveOffset}`;
```

### 2. Pagination Utilities

```typescript
import { paginationConfig, validatePageSize, buildSqlPagination } from '@/lib/config/pagination';

// Get config values
paginationConfig.defaultPageSize      // 50
paginationConfig.maxPageSize           // 1000
paginationConfig.dataTablePageSize     // 100
paginationConfig.exportPageSize        // 1000

// Validate user requested size
const safeSize = validatePageSize(5000); // Returns 1000 (max)

// Build SQL pagination
const { limit, offset } = buildSqlPagination(page, pageSize);
```

### 3. Frontend Integration

Frontend components must request specific pages:

```typescript
// Correct: Request page 3 with page size 100
const response = await fetch('/api/sql/execute', {
  method: 'POST',
  body: JSON.stringify({
    sql: 'SELECT * FROM users',
    limit: 100,
    offset: 200  // (page - 1) * pageSize
  })
});

// Response includes pagination metadata:
{
  pagination: {
    limit: 100,
    offset: 200,
    hasMore: true,
    serverSide: true  // Explicitly marked
  }
}
```

## Benefits of Server-Side Pagination

1. **Reduced Server Load**: Only fetches needed data, not entire tables
2. **Faster Response Times**: Smaller result sets = faster queries
3. **Lower Memory Usage**: Server doesn't need to hold huge datasets
4. **Scalability**: Handles millions of rows efficiently
5. **Network Efficiency**: Transfers less data over the wire

## Implementation Examples

### SQL Editor Component
```typescript
const PAGE_SIZE = paginationConfig.dataTablePageSize;

// User clicks "Next Page"
const handleNextPage = () => {
  const newOffset = currentPage * PAGE_SIZE;
  executeQuery(sql, PAGE_SIZE, newOffset);
};
```

### Report Generation
```typescript
// Export in batches
const BATCH_SIZE = paginationConfig.exportPageSize;
const totalRows = 50000;
const batches = Math.ceil(totalRows / BATCH_SIZE);

for (let i = 0; i < batches; i++) {
  const offset = i * BATCH_SIZE;
  const data = await fetchReportData(reportId, BATCH_SIZE, offset);
  await appendToExport(data);
}
```

### Data Tables with Virtual Scrolling
```typescript
// When dataset is large, use virtual scrolling + server-side fetching
const useVirtualScroll = totalRows >= paginationConfig.virtualScrollThreshold;

if (useVirtualScroll) {
  // Fetch visible range only
  const { startIndex, endIndex } = getVisibleRange();
  const pageSize = endIndex - startIndex;
  const data = await fetchData(startIndex, pageSize);
}
```

## Monitoring and Alerts

The system includes warning configurations for pagination issues:

### Large Result Set Warning
```javascript
{
  warning_code: 'LARGE_RESULT_SET',
  trigger_config: {
    threshold_rows: 10000,
    threshold_time_ms: 5000
  },
  message: 'This query returned {row_count} rows. Consider adding filters.'
}
```

### Slow Query Warning
```javascript
{
  warning_code: 'SLOW_QUERY',
  trigger_config: {
    warning_threshold_ms: 10000,
    critical_threshold_ms: 30000
  },
  message: 'Query is taking longer than expected ({duration_ms}ms).'
}
```

## Enforcement Rules

1. **Hard Limit**: No query can return more than `MAX_PAGE_SIZE` rows
2. **Auto-LIMIT**: Queries without LIMIT get one added automatically
3. **Validation**: User-provided LIMITs are validated against max
4. **Monitoring**: All queries are logged with row counts and execution time

## Migration Guide

### ❌ WRONG (Client-Side Pagination)
```typescript
// BAD: Fetches ALL data, paginates in browser
const allData = await fetch('/api/users');  // Returns 100,000 rows
const page = allData.slice(offset, offset + pageSize);  // Client filtering
```

### ✅ CORRECT (Server-Side Pagination)
```typescript
// GOOD: Fetches only needed data
const data = await fetch('/api/users?limit=100&offset=200');  // Returns 100 rows
```

## Configuration Best Practices

1. **Development**: Use smaller page sizes (50-100) for faster testing
2. **Production**: Increase based on server capacity (100-1000)
3. **Exports**: Use larger batches (1000-5000) for efficiency
4. **Virtual Scrolling**: Enable for tables with 500+ rows
5. **Monitor**: Track query times and adjust page sizes accordingly

## Testing

Verify server-side pagination:

```bash
# Test 1: Check auto-LIMIT
curl -X POST http://localhost:4050/api/sql/execute \
  -H "Content-Type: application/json" \
  -d '{"sql":"SELECT * FROM users","dataSourceId":"xxx"}'
# Should auto-add LIMIT 100

# Test 2: Check page size validation
curl -X POST http://localhost:4050/api/sql/execute \
  -H "Content-Type: application/json" \
  -d '{"sql":"SELECT * FROM users LIMIT 5000","dataSourceId":"xxx"}'
# Should reduce LIMIT to 1000

# Test 3: Check offset handling
curl -X POST http://localhost:4050/api/sql/execute \
  -H "Content-Type: application/json" \
  -d '{"sql":"SELECT * FROM users","limit":50,"offset":100}'
# Should return rows 101-150
```

## Troubleshooting

### Issue: Browser freezes on large datasets
**Cause**: Client-side pagination
**Fix**: Ensure API uses LIMIT/OFFSET

### Issue: Slow page loads
**Cause**: Page size too large
**Fix**: Reduce `DATA_TABLE_PAGE_SIZE` in .env

### Issue: Memory errors
**Cause**: Exceeding MAX_PAGE_SIZE
**Fix**: Lower max limit or optimize queries

## References

- Pagination Config: `src/lib/config/pagination.ts`
- SQL Execute API: `src/app/api/sql/execute/route.ts`
- Environment Config: `.env.local`
