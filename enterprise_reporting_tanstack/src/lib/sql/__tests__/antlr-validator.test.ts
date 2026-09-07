import { describe, expect, it } from "bun:test";
import {
  extractColumns,
  extractTables,
  isReadOnlyQuery,
  validateSQLWithAllowlist,
} from "../antlr-validator";

describe("ANTLR Validator", () => {
  describe("validateSQLWithAllowlist", () => {
    it("should allow basic SELECT queries", () => {
      const result = validateSQLWithAllowlist("SELECT * FROM users");
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("should allow SELECT with WHERE", () => {
      const result = validateSQLWithAllowlist("SELECT id, name FROM users WHERE age > 18");
      expect(result.valid).toBe(true);
    });

    it("should allow JOINs", () => {
      const result = validateSQLWithAllowlist(
        "SELECT u.id, o.id FROM users u INNER JOIN orders o ON u.id = o.user_id"
      );
      expect(result.valid).toBe(true);
    });

    it("should block DROP statements", () => {
      const result = validateSQLWithAllowlist("DROP TABLE users");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("DROP"))).toBe(true);
    });

    it("should block DELETE statements", () => {
      const result = validateSQLWithAllowlist("DELETE FROM users WHERE id = 1");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("DELETE"))).toBe(true);
    });

    it("should block INSERT statements", () => {
      const result = validateSQLWithAllowlist('INSERT INTO users (name) VALUES ("John")');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("INSERT"))).toBe(true);
    });

    it("should block UPDATE statements", () => {
      const result = validateSQLWithAllowlist('UPDATE users SET name = "Jane" WHERE id = 1');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("UPDATE"))).toBe(true);
    });

    it("should block CREATE statements", () => {
      const result = validateSQLWithAllowlist("CREATE TABLE users (id INT)");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("CREATE"))).toBe(true);
    });

    it("should detect SQL injection patterns", () => {
      const result = validateSQLWithAllowlist("SELECT * FROM users WHERE id = '1' OR '1'='1'");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("injection"))).toBe(true);
    });

    it("should warn on SELECT *", () => {
      const result = validateSQLWithAllowlist("SELECT * FROM users");
      expect(result.warnings.some((w) => w.message.includes("SELECT *"))).toBe(true);
    });

    it("should warn on missing LIMIT", () => {
      const result = validateSQLWithAllowlist("SELECT id FROM users");
      expect(result.warnings.some((w) => w.message.includes("LIMIT"))).toBe(true);
    });

    it("should allow queries with LIMIT", () => {
      const result = validateSQLWithAllowlist("SELECT id FROM users LIMIT 100");
      expect(result.warnings.some((w) => w.message.includes("LIMIT"))).toBe(false);
    });

    it("should detect mismatched parentheses", () => {
      const result = validateSQLWithAllowlist("SELECT * FROM (users WHERE id = 1");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("parentheses"))).toBe(true);
    });

    it("should allow CTEs", () => {
      const result = validateSQLWithAllowlist(`
        WITH top_users AS (
          SELECT id, name FROM users WHERE active = true
        )
        SELECT * FROM top_users
      `);
      expect(result.valid).toBe(true);
      expect(result.analysis?.hasCTE).toBe(true);
    });

    it("should allow UNIONs", () => {
      const result = validateSQLWithAllowlist(`
        SELECT id FROM users
        UNION
        SELECT id FROM archived_users
      `);
      expect(result.valid).toBe(true);
    });

    it("should allow aggregate functions", () => {
      const result = validateSQLWithAllowlist(
        "SELECT COUNT(*), SUM(amount), AVG(price) FROM orders"
      );
      expect(result.valid).toBe(true);
    });

    it("should allow CASE expressions", () => {
      const result = validateSQLWithAllowlist(`
        SELECT
          CASE
            WHEN age >= 18 THEN 'Adult'
            ELSE 'Minor'
          END as age_group
        FROM users
      `);
      expect(result.valid).toBe(true);
    });

    it("should allow GROUP BY", () => {
      const result = validateSQLWithAllowlist(
        "SELECT category, COUNT(*) FROM products GROUP BY category HAVING COUNT(*) > 5"
      );
      expect(result.valid).toBe(true);
    });

    it("should allow ORDER BY", () => {
      const result = validateSQLWithAllowlist(
        "SELECT * FROM users ORDER BY created_at DESC LIMIT 10"
      );
      expect(result.valid).toBe(true);
    });
  });

  describe("extractTables", () => {
    it("should extract single table", () => {
      const tables = extractTables("SELECT * FROM users");
      expect(tables).toContain("users");
    });

    it("should extract multiple tables from JOIN", () => {
      const tables = extractTables("SELECT * FROM users u JOIN orders o ON u.id = o.user_id");
      expect(tables).toContain("users");
      expect(tables).toContain("orders");
    });

    it("should extract tables with schema qualification", () => {
      const tables = extractTables("SELECT * FROM public.users");
      expect(tables.some((t) => t.includes("users"))).toBe(true);
    });
  });

  describe("extractColumns", () => {
    it("should extract columns from SELECT", () => {
      const columns = extractColumns("SELECT id, name, email FROM users");
      expect(columns).toContain("id");
      expect(columns).toContain("name");
      expect(columns).toContain("email");
    });

    it("should extract table-qualified columns", () => {
      const columns = extractColumns("SELECT u.id, o.total FROM users u JOIN orders o");
      expect(columns.some((c) => c.includes("id"))).toBe(true);
    });
  });

  describe("isReadOnlyQuery", () => {
    it("should recognize SELECT as read-only", () => {
      expect(isReadOnlyQuery("SELECT * FROM users")).toBe(true);
    });

    it("should recognize WITH as read-only", () => {
      expect(isReadOnlyQuery("WITH cte AS (SELECT 1) SELECT * FROM cte")).toBe(true);
    });

    it("should reject INSERT", () => {
      expect(isReadOnlyQuery("INSERT INTO users VALUES (1)")).toBe(false);
    });

    it("should reject DELETE", () => {
      expect(isReadOnlyQuery("DELETE FROM users")).toBe(false);
    });

    it("should reject UPDATE", () => {
      expect(isReadOnlyQuery('UPDATE users SET name = "test"')).toBe(false);
    });

    it("should handle leading comments", () => {
      expect(isReadOnlyQuery("-- This is a comment\nSELECT * FROM users")).toBe(true);
    });

    it("should handle multiline comments", () => {
      expect(isReadOnlyQuery("/* Comment */ SELECT * FROM users")).toBe(true);
    });
  });
});
