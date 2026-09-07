/**
 * Server-Side Pagination Configuration
 *
 * All pagination settings are controlled via environment variables
 * to ensure consistent behavior across the application.
 */

export interface PaginationConfig {
  // Default page size for general queries
  defaultPageSize: number;
  // Maximum page size a user can request
  maxPageSize: number;
  // Default page size for data tables
  dataTablePageSize: number;
  // Page size for exporting data
  exportPageSize: number;
  // Threshold for enabling virtual scrolling
  virtualScrollThreshold: number;
  // Whether virtual scrolling is enabled
  enableVirtualScrolling: boolean;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === "true";
}

export const paginationConfig: PaginationConfig = {
  defaultPageSize: getEnvNumber("DEFAULT_PAGE_SIZE", 50),
  maxPageSize: getEnvNumber("MAX_PAGE_SIZE", 1000),
  dataTablePageSize: getEnvNumber("DATA_TABLE_PAGE_SIZE", 500), // Server-side: 500 rows per page
  exportPageSize: getEnvNumber("EXPORT_PAGE_SIZE", 1000),
  virtualScrollThreshold: getEnvNumber("VIRTUAL_SCROLL_THRESHOLD", 500),
  enableVirtualScrolling: getEnvBoolean("ENABLE_VIRTUAL_SCROLLING", true),
};

// Client-side pagination for SQL Editor results
export const sqlEditorConfig = {
  serverPageSize: 100, // Server-side page size
  maxClientRows: 5000, // Maximum rows to accumulate client-side
  maxPagesToLoad: 50, // Maximum number of pages to accumulate
};

/**
 * Validates and adjusts page size to be within allowed bounds
 */
export function validatePageSize(requestedSize: number): number {
  const min = 1;
  const max = paginationConfig.maxPageSize;

  if (requestedSize < min) return min;
  if (requestedSize > max) return max;
  return requestedSize;
}

/**
 * Calculates the offset for database queries
 */
export function calculateOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

/**
 * Determines if virtual scrolling should be used for a dataset
 */
export function shouldUseVirtualScrolling(totalRows: number): boolean {
  return (
    paginationConfig.enableVirtualScrolling && totalRows >= paginationConfig.virtualScrollThreshold
  );
}

/**
 * Pagination metadata interface
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Creates pagination metadata
 */
export function createPaginationMeta(
  page: number,
  pageSize: number,
  totalRows: number
): PaginationMeta {
  const totalPages = Math.ceil(totalRows / pageSize);

  return {
    page,
    pageSize,
    totalRows,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}

/**
 * Builds LIMIT and OFFSET clause for SQL queries
 */
export function buildSqlPagination(
  page?: number,
  pageSize?: number
): { limit: number; offset: number } {
  const validatedPageSize = validatePageSize(pageSize || paginationConfig.defaultPageSize);
  const validatedPage = Math.max(1, page || 1);

  return {
    limit: validatedPageSize,
    offset: calculateOffset(validatedPage, validatedPageSize),
  };
}
