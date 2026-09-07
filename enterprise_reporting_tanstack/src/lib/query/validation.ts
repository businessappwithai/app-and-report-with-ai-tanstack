/**
 * Client-side SQL validation for DuckDB queries.
 * Basic structural checks before sending to DuckDB-Wasm for execution.
 */

interface ValidationResult {
  valid: boolean;
  errors: { message: string; line?: number }[];
  warnings: { message: string }[];
}

const DANGEROUS_PATTERNS = [
  /\bDROP\s+DATABASE\b/i,
  /\bDROP\s+ALL\b/i,
  /\bATTACH\b/i,
  /\bDETACH\b/i,
  /\bCOPY\b.*\bTO\b/i,
  /\bEXPORT\b/i,
  /\bIMPORT\b/i,
];

const MAX_QUERY_LENGTH = 100_000;

/**
 * Validate a SQL query for client-side execution in DuckDB-Wasm.
 */
export function validateDuckDBQuery(sql: string): ValidationResult {
  const errors: { message: string; line?: number }[] = [];
  const warnings: { message: string }[] = [];

  const trimmed = sql.trim();

  if (!trimmed) {
    errors.push({ message: "Query is empty" });
    return { valid: false, errors, warnings };
  }

  if (trimmed.length > MAX_QUERY_LENGTH) {
    errors.push({ message: `Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters` });
    return { valid: false, errors, warnings };
  }

  // Check for dangerous statements
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      errors.push({ message: `Dangerous statement detected: ${pattern.source}` });
    }
  }

  // Check for balanced parentheses
  let depth = 0;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === "(") depth++;
    if (trimmed[i] === ")") depth--;
    if (depth < 0) {
      errors.push({ message: "Unbalanced parentheses" });
      break;
    }
  }
  if (depth > 0) {
    errors.push({ message: "Unclosed parenthesis" });
  }

  // Check for unmatched quotes
  let inSingleQuote = false;
  let inDoubleQuote = false;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === "'" && !inDoubleQuote) inSingleQuote = !inSingleQuote;
    if (ch === '"' && !inSingleQuote) inDoubleQuote = !inDoubleQuote;
  }
  if (inSingleQuote) errors.push({ message: "Unmatched single quote" });
  if (inDoubleQuote) errors.push({ message: "Unmatched double quote" });

  // Warnings
  if (/\bSELECT\s+\*/i.test(trimmed)) {
    warnings.push({
      message: "SELECT * may return more data than needed. Consider specifying columns.",
    });
  }

  if (!/\bLIMIT\b/i.test(trimmed) && /\bSELECT\b/i.test(trimmed)) {
    warnings.push({ message: "No LIMIT clause. Large result sets may use significant memory." });
  }

  return { valid: errors.length === 0, errors, warnings };
}
