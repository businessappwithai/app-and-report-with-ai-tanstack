/**
 * CSV export for the list grids.
 *
 * Every grid in the application offers its list as a CSV download. The rows are
 * fetched from the API rather than taken off the screen, so the file holds the
 * list the reader is looking at rather than the page of it they happen to be
 * on — capped at CSV_EXPORT_LIMIT rows, because this is a convenience export
 * and not a data dump: a browser building the whole string in memory and a
 * server paging an unbounded table are both worth avoiding.
 */

/**
 * The most rows any one export contains.
 *
 * The same number the grid's lookup queries already use as their ceiling, which
 * is not a coincidence: labels for referenced records are resolved from those
 * queries, so an export longer than they are would print raw uuids past the
 * cut.
 */
export const CSV_EXPORT_LIMIT = 500;

/**
 * One field, quoted the way RFC 4180 asks.
 *
 * Quotes are doubled and the field is wrapped whenever it holds a comma, a
 * quote, a line break or leading/trailing space — an unwrapped field with a
 * newline in it silently becomes two rows, which is the failure that makes a
 * export look fine and import wrong.
 */
function escapeField(value: string): string {
  const needsQuotes = /[",\r\n]/.test(value) || value !== value.trim();
  if (!needsQuotes) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Defuse a field a spreadsheet would treat as a formula.
 *
 * Excel, LibreOffice and Sheets all evaluate a cell that opens with `=`, `+`,
 * `-`, `@` or a control character, so a record whose name a user typed as
 * `=HYPERLINK(...)` executes on open. The value is data, so it is prefixed with
 * an apostrophe — the convention those applications read back as "this is
 * text". Numbers are left alone: a leading `-` on something that parses as a
 * number is a minus sign, not an injection.
 */
function defuseFormula(value: string): string {
  if (value === "") return value;
  if (!/^[=+\-@\t\r]/.test(value)) return value;
  if (/^-?\d+(\.\d+)?$/.test(value)) return value;
  return `'${value}`;
}

/** A CSV document: one header row, then the rows, CRLF-separated per RFC 4180. */
export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((cells) =>
    cells.map((cell) => escapeField(defuseFormula(cell ?? ""))).join(",")
  );
  return lines.join("\r\n");
}

/**
 * Hand the CSV to the browser as a download.
 *
 * The byte order mark is what makes Excel read the file as UTF-8; without it
 * every non-ASCII name in the export arrives mojibaked, which for an
 * application generated from a model in any language is most of them.
 */
export function downloadCsv(fileName: string, csv: string): void {
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

/** `bus_class_session` on 2026-09-04 → `class-session-2026-09-04.csv`. */
export function csvFileName(tableName: string): string {
  const stem = tableName
    .replace(/^bus_/, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  return `${stem || "export"}-${today}.csv`;
}
