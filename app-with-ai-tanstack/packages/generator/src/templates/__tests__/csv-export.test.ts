/**
 * The CSV every list grid hands over.
 *
 * A CSV is read by a spreadsheet, which makes two things load-bearing that a
 * naive `cells.join(",")` gets wrong:
 *
 *  - Quoting. A value holding a comma, a quote or a newline has to be wrapped
 *    or the file imports as a different table from the one exported — an
 *    unwrapped newline silently becomes an extra row.
 *  - Formulas. Excel, LibreOffice and Sheets all evaluate a cell that opens
 *    with `=`, `+`, `-` or `@`, so a record whose name somebody typed as
 *    `=HYPERLINK(...)` executes when the file is opened.
 *
 * These import the module the generator copies into every application, so what
 * is asserted here is what ships.
 */

import { describe, expect, it } from "vitest";
import {
  CSV_EXPORT_LIMIT,
  csvFileName,
  toCsv,
} from "../../../templates/tanstack-start-nestjs/frontend/src/lib/csv";

/** Parse a CSV back, so a claim about escaping is checked by a reader. */
function parse(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (quoted) {
      if (char === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r" && csv[i + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else field += char;
  }
  row.push(field);
  rows.push(row);
  return rows;
}

describe("toCsv", () => {
  it("writes a header row and the rows under it", () => {
    expect(
      parse(
        toCsv(
          ["A", "B"],
          [
            ["1", "2"],
            ["3", "4"],
          ]
        )
      )
    ).toEqual([
      ["A", "B"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("separates rows with CRLF, which is what RFC 4180 asks for", () => {
    expect(toCsv(["A"], [["1"]])).toBe("A\r\n1");
  });

  it("quotes a value holding a comma, and it reads back whole", () => {
    expect(parse(toCsv(["Name"], [["Smith, John"]]))[1]).toEqual(["Smith, John"]);
  });

  it("doubles an embedded quote, and it reads back whole", () => {
    const csv = toCsv(["Name"], [['Smith, John "JJ"']]);
    expect(csv).toContain('"Smith, John ""JJ"""');
    expect(parse(csv)[1]).toEqual(['Smith, John "JJ"']);
  });

  it("contains a newline inside one field rather than starting a row", () => {
    const csv = toCsv(["Note"], [["line one\nline two"]]);
    const rows = parse(csv);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual(["line one\nline two"]);
  });

  it("quotes a value with leading or trailing space, which a reader would trim", () => {
    expect(parse(toCsv(["A"], [["  padded  "]]))[1]).toEqual(["  padded  "]);
  });

  it.each(['=HYPERLINK("http://evil","x")', "+1 555", "@SUM(A1)", "\tstartsWithTab"])(
    "defuses %j, which a spreadsheet would otherwise evaluate",
    (hostile) => {
      expect(parse(toCsv(["A"], [[hostile]]))[1][0]).toBe(`'${hostile}`);
    }
  );

  it("leaves a negative number alone — that minus is a sign, not an injection", () => {
    expect(parse(toCsv(["A"], [["-1234"]]))[1]).toEqual(["-1234"]);
    expect(parse(toCsv(["A"], [["-12.5"]]))[1]).toEqual(["-12.5"]);
  });

  it("writes an empty field as empty rather than as a quoted nothing", () => {
    expect(toCsv(["A", "B"], [["", "x"]])).toBe("A,B\r\n,x");
  });
});

describe("the export cap", () => {
  it("is 500 rows", () => {
    expect(CSV_EXPORT_LIMIT).toBe(500);
  });
});

describe("csvFileName", () => {
  it("names the file after the entity and the day", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(csvFileName("bus_class_session")).toBe(`class-session-${today}.csv`);
    expect(csvFileName("member")).toBe(`member-${today}.csv`);
  });

  it("never produces a name that is only a date", () => {
    expect(csvFileName("")).toMatch(/^export-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
