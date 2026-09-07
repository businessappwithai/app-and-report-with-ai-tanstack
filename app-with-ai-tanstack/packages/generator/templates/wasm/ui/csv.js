/**
 * CSV export for the browser application's grids.
 *
 * The same contract as the NestJS stack's `frontend/src/lib/csv.ts`, and
 * deliberately a separate file rather than a shared one: this application is
 * plain ES modules served from a Service Worker with no build step, and that
 * one is TypeScript compiled by vinxi. Neither can import the other. What has
 * to match is the behaviour — the cap, the quoting, the formula defusing and
 * the byte order mark — so a reader who exports the same model from either
 * application gets the same file.
 */

/**
 * The most rows any one export contains.
 *
 * A convenience export, not a data dump: a browser building the whole string in
 * memory and a server paging an unbounded table are both worth avoiding. The
 * NestJS stack uses the same number.
 */
export const CSV_EXPORT_LIMIT = 500;

/**
 * One field, quoted the way RFC 4180 asks.
 *
 * Quotes are doubled and the field is wrapped whenever it holds a comma, a
 * quote, a line break or leading/trailing space — an unwrapped newline silently
 * becomes an extra row, so the file imports as a different table from the one
 * exported.
 */
function escapeField(value) {
  const needsQuotes = /[",\r\n]/.test(value) || value !== value.trim();
  return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Defuse a field a spreadsheet would treat as a formula.
 *
 * Excel, LibreOffice and Sheets all evaluate a cell that opens with `=`, `+`,
 * `-`, `@` or a control character, so a record whose name a user typed as
 * `=HYPERLINK(...)` executes when the file is opened. Numbers are left alone: a
 * leading `-` on something that parses as a number is a minus sign.
 */
function defuseFormula(value) {
  if (value === "") return value;
  if (!/^[=+\-@\t\r]/.test(value)) return value;
  if (/^-?\d+(\.\d+)?$/.test(value)) return value;
  return `'${value}`;
}

/** A CSV document: one header row, then the rows, CRLF-separated per RFC 4180. */
export function toCsv(headers, rows) {
  return [headers, ...rows]
    .map((cells) => cells.map((cell) => escapeField(defuseFormula(cell ?? ""))).join(","))
    .join("\r\n");
}

/**
 * Hand the CSV to the browser as a download.
 *
 * The byte order mark is what makes Excel read the file as UTF-8; without it
 * every non-ASCII name arrives mojibaked.
 */
export function downloadCsv(fileName, csv) {
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** `class-session` on 2026-09-04 → `class-session-2026-09-04.csv`. */
export function csvFileName(route) {
  const stem = String(route ?? "")
    .replace(/^bus_/, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${stem || "export"}-${new Date().toISOString().slice(0, 10)}.csv`;
}
