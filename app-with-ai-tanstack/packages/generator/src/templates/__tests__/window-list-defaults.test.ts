/**
 * `sys_window.where_clause` and `sys_window.order_by_clause`, and the promise
 * that neither of them is SQL.
 *
 * Both are edited from the Application Dictionary's Window screen, so whatever
 * an administrator types reaches the query builder. If either were interpolated
 * into a statement, that text box would be the application's most direct
 * injection route. The parser is a whitelist instead: a clause resolves to a
 * column the dictionary declares and an operator from a fixed table, or it is
 * dropped with a reason.
 *
 * These tests import the module the generator copies into every application
 * verbatim, so what is asserted here is what ships.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_ORDER_BY_CLAUSE,
  parseOrderByClause,
  parseWhereClause,
} from "../../../templates/tanstack-start-nestjs/backend/src/modules/bus/window-list-defaults";

/** A plausible entity: what the dictionary declares, plus the audit columns. */
const COLUMNS = [
  "id",
  "email",
  "full_name",
  "status",
  "joined_on",
  "marketing_opt_in",
  "created_at",
  "updated_at",
];

describe("order_by_clause", () => {
  it("defaults to the most recently modified record first", () => {
    expect(DEFAULT_ORDER_BY_CLAUSE).toBe("updated_at DESC");
    const { terms } = parseOrderByClause(DEFAULT_ORDER_BY_CLAUSE, COLUMNS);
    expect(terms).toEqual([{ column: "updated_at", direction: "desc" }]);
  });

  it("reads a column with no direction as ascending", () => {
    expect(parseOrderByClause("full_name", COLUMNS).terms).toEqual([
      { column: "full_name", direction: "asc" },
    ]);
  });

  it("takes several terms in order, and is case-insensitive about the direction", () => {
    expect(parseOrderByClause("status desc, full_name AsC", COLUMNS).terms).toEqual([
      { column: "status", direction: "desc" },
      { column: "full_name", direction: "asc" },
    ]);
  });

  it("drops a column the entity does not have, and says which", () => {
    const { terms, warnings } = parseOrderByClause("nope DESC, status ASC", COLUMNS);
    expect(terms).toEqual([{ column: "status", direction: "asc" }]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].reason).toContain("no column 'nope'");
  });

  it("names each column once, so a repeat cannot emit a duplicate ORDER BY", () => {
    expect(parseOrderByClause("status ASC, status DESC", COLUMNS).terms).toEqual([
      { column: "status", direction: "asc" },
    ]);
  });

  it("returns nothing for an empty clause, which the caller reads as 'use the default'", () => {
    for (const empty of ["", "   ", null, undefined]) {
      expect(parseOrderByClause(empty, COLUMNS).terms).toEqual([]);
    }
  });

  // The point of the whole module.
  it.each([
    "updated_at; DROP TABLE bus_member",
    "(SELECT version())",
    "updated_at DESC; --",
    "1",
    "updated_at DESC NULLS FIRST",
    "CASE WHEN 1=1 THEN id END",
    "pg_sleep(10)",
    "updated_at/**/DESC,(SELECT 1)",
    "status ASC UNION SELECT * FROM sys_user",
  ])("refuses to order by %j", (clause) => {
    const { terms } = parseOrderByClause(clause, COLUMNS);
    // Anything that survives is a bare column name from COLUMNS — never the
    // punctuation, the call, or the keyword that made the clause dangerous.
    for (const term of terms) {
      expect(COLUMNS).toContain(term.column);
    }
    expect(terms.map((t) => t.column).join(" ")).not.toMatch(/[^a-z_ ]/);
  });
});

describe("where_clause", () => {
  it("builds an equality", () => {
    const { filters } = parseWhereClause("status=equals:active", COLUMNS);
    expect(filters).toEqual({ status: { operator: "=", value: "active" } });
  });

  it("builds the three pattern operators, and the caller never writes the pattern", () => {
    expect(parseWhereClause("full_name=contains:ann", COLUMNS).filters).toEqual({
      full_name: { operator: "ilike", value: "%ann%" },
    });
    expect(parseWhereClause("full_name=startsWith:ann", COLUMNS).filters).toEqual({
      full_name: { operator: "ilike", value: "ann%" },
    });
    expect(parseWhereClause("full_name=endsWith:ann", COLUMNS).filters).toEqual({
      full_name: { operator: "ilike", value: "%ann" },
    });
  });

  it("escapes a LIKE wildcard in the value, so a literal % stays literal", () => {
    expect(parseWhereClause("full_name=contains:50% off", COLUMNS).filters).toEqual({
      full_name: { operator: "ilike", value: "%50\\% off%" },
    });
  });

  it("builds the comparison operators", () => {
    expect(parseWhereClause("updated_at=gte:2026-09-04T04:00:00Z", COLUMNS).filters).toEqual({
      updated_at: { operator: ">=", value: "2026-09-04T04:00:00Z" },
    });
    expect(parseWhereClause("joined_on=lt:2026-01-01", COLUMNS).filters).toEqual({
      joined_on: { operator: "<", value: "2026-01-01" },
    });
  });

  it("builds the two null tests, whose value is meant to be null", () => {
    expect(parseWhereClause("phone=isNull", [...COLUMNS, "phone"]).filters).toEqual({
      phone: { operator: "is", value: null },
    });
    expect(parseWhereClause("phone=isNotNull", [...COLUMNS, "phone"]).filters).toEqual({
      phone: { operator: "is not", value: null },
    });
  });

  it("takes several clauses", () => {
    const { filters } = parseWhereClause("status=equals:active, full_name=contains:ann", COLUMNS);
    expect(filters).toEqual({
      status: { operator: "=", value: "active" },
      full_name: { operator: "ilike", value: "%ann%" },
    });
  });

  it("keeps a quoted value whole, commas and all", () => {
    const { filters } = parseWhereClause('full_name=equals:"Smith, John"', COLUMNS);
    expect(filters).toEqual({ full_name: { operator: "=", value: "Smith, John" } });
  });

  it("drops an unknown column, an unknown operator and a missing value, each with a reason", () => {
    const { filters, warnings } = parseWhereClause(
      "nope=equals:x, status=frobnicate:y, email=equals:",
      COLUMNS
    );
    expect(filters).toEqual({});
    expect(warnings.map((w) => w.reason)).toEqual([
      "no column 'nope' on this entity",
      "unknown operator 'frobnicate'",
      "no value",
    ]);
  });

  // The point of the whole module, again.
  it.each([
    "1=1; DROP TABLE bus_member; --",
    "(SELECT 1)=equals:x",
    "status=equals:active OR 1=1",
    "status=equals:active; DELETE FROM bus_member",
    "email=equals:x' OR '1'='1",
    "status)=equals:x",
    "status=equals:x UNION SELECT password FROM sys_user",
  ])("cannot be made to emit SQL by %j", (clause) => {
    const { filters } = parseWhereClause(clause, COLUMNS);
    for (const [column, spec] of Object.entries(filters)) {
      // Only a declared column can be a key, and the operator can only be one
      // of the fixed set — the injected text can survive as a *value*, which is
      // exactly where it is harmless, because Kysely binds it as a parameter.
      expect(COLUMNS).toContain(column);
      expect(["=", "!=", "<", "<=", ">", ">=", "ilike", "is", "is not"]).toContain(spec.operator);
    }
  });

  it("treats injected SQL in a value as the string it is", () => {
    // `active OR 1=1` is a value nothing equals, which is the correct answer:
    // it matches no rows rather than every row.
    expect(parseWhereClause("status=equals:active OR 1=1", COLUMNS).filters).toEqual({
      status: { operator: "=", value: "active OR 1=1" },
    });
  });

  it("returns nothing for an empty clause", () => {
    for (const empty of ["", "   ", null, undefined]) {
      expect(parseWhereClause(empty, COLUMNS).filters).toEqual({});
    }
  });
});

/**
 * A clause the column's type cannot be compared against.
 *
 * `id=equals:not-a-uuid` reaches PostgreSQL as `uuid = 'not-a-uuid'`, which is
 * error 22P02 — so the list answered 400 and the screen went blank, for a
 * clause somebody typed into a text box. The value was always bound as a
 * parameter, so this was never an injection; it was a bad clause taking the
 * list down instead of being dropped like every other bad clause.
 */
describe("where_clause against the column's declared type", () => {
  // sys_reference_id: 13 ID (uuid), 11 INTEGER, 20 YES_NO, 15 DATE, 10 STRING
  const TYPES = new Map<string, number>([
    ["id", 13],
    ["status", 10],
    ["full_name", 10],
    ["joined_on", 15],
    ["marketing_opt_in", 20],
    ["visit_count", 11],
  ]);
  const NAMES = [...TYPES.keys()];

  it("drops a non-uuid compared to a uuid column, with a reason", () => {
    const { filters, warnings } = parseWhereClause("id=equals:x' OR '1'='1", NAMES, TYPES);
    expect(filters).toEqual({});
    expect(warnings[0].reason).toContain("not a value column 'id' can be compared against");
  });

  it("keeps a real uuid", () => {
    const uuid = "00000000-0000-0000-0000-000000000000";
    expect(parseWhereClause(`id=equals:${uuid}`, NAMES, TYPES).filters).toEqual({
      id: { operator: "=", value: uuid },
    });
  });

  it("drops non-numbers on a number column and non-dates on a date column", () => {
    expect(parseWhereClause("visit_count=gte:many", NAMES, TYPES).filters).toEqual({});
    expect(parseWhereClause("joined_on=lt:whenever", NAMES, TYPES).filters).toEqual({});
    expect(parseWhereClause("visit_count=gte:5", NAMES, TYPES).filters).toEqual({
      visit_count: { operator: ">=", value: "5" },
    });
  });

  it("drops a non-boolean on a yes/no column", () => {
    expect(parseWhereClause("marketing_opt_in=equals:maybe", NAMES, TYPES).filters).toEqual({});
    expect(parseWhereClause("marketing_opt_in=equals:true", NAMES, TYPES).filters).toEqual({
      marketing_opt_in: { operator: "=", value: "true" },
    });
  });

  it("still allows a pattern match on any column, which compares as text", () => {
    // The query casts the column to text for `ilike`, so the column's own type
    // does not have to accept the value.
    expect(parseWhereClause("id=contains:0000", NAMES, TYPES).filters).toEqual({
      id: { operator: "ilike", value: "%0000%" },
    });
  });

  it("checks nothing when no types are supplied, so the column name stays the whitelist", () => {
    expect(parseWhereClause("id=equals:not-a-uuid", NAMES).filters).toEqual({
      id: { operator: "=", value: "not-a-uuid" },
    });
  });
});
