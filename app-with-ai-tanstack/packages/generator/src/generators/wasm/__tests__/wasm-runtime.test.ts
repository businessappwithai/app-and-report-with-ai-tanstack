/**
 * Tests for the browser stack.
 *
 * The runtime ships as plain ES modules under `templates/wasm`, so these import
 * it the way a generated application does — by path, not through the generator.
 * That is the point: a test that exercised a TypeScript copy would pass while
 * the bytes actually written into an application were broken.
 */

import {
  kebabCase as coreKebab,
  pascalCase as corePascal,
  snakeCase as coreSnake,
} from "@appwithai/core/utils";
import { describe, expect, it } from "vitest";
// @ts-expect-error — plain JavaScript shipped into generated applications
import { evaluate, test as testExpression } from "../../../../templates/wasm/server/lib/expr.js";
// @ts-expect-error — plain JavaScript shipped into generated applications
import { holdsRole } from "../../../../templates/wasm/server/lib/guards.js";
// @ts-expect-error — plain JavaScript shipped into generated applications
import {
  kebabCase,
  pascalCase,
  snakeCase,
  toTableName,
} from "../../../../templates/wasm/server/lib/naming.js";
// @ts-expect-error — plain JavaScript shipped into generated applications
import { evaluateRules, interpretCondition } from "../../../../templates/wasm/server/lib/rules.js";
import { parseModel } from "../../../pipeline/parse-model";
import { buildModelBundle } from "../model-bundle";
import { RUNTIME_ASSETS } from "../runtime-assets.generated";
import { generateWasmApp } from "../wasm-app.generator";

const MODEL = `
erDiagram
    Order {
        string id PK
        string reference
        string status
        decimal total
        boolean is_rush
    }
    OrderLine {
        string id PK
        string order_id FK
        integer quantity
    }
    Order ||--o{ OrderLine : has

%%category name: Sales; description: Orders and their lines; entities: Order, OrderLine

%%enum OrderStatus: draft, submitted, approved
%%field Order.status enum: OrderStatus

%%rbac role:sales_manager on Order.delete

%%meta kind: rules
%%rule orderGate on Order event: beforeUpdate priority: 10
flowchart TD
    A([Start]) --> B{Status == draft?}
    B -->|No| X1[Reject: Not a draft]
    B -->|Yes| C{Reference provided?}
    C -->|No| X2[Reject: Reference Required]
    C -->|Yes| P[Set status: submitted]
    X1 --> Z([End])
    X2 --> Z
    P --> Z

%%workflow OrderFlow entity: Order kind: state
stateDiagram-v2
    [*] --> draft
    draft --> submitted: submit
    submitted --> approved: approve
`;

const settings = {
  name: "Test App",
  version: "1.0.0",
  description: "A test",
  adminEmail: "admin@admin.com",
  adminPassword: "admin",
  adminName: "admin",
};

describe("the expression language", () => {
  it("evaluates the forms rule and automation conditions use", () => {
    expect(evaluate("amount > 1000", { amount: 2000 })).toBe(true);
    expect(evaluate("status == 'draft'", { status: "draft" })).toBe(true);
    expect(evaluate("qty * price", { qty: 3, price: 5 })).toBe(15);
    expect(evaluate("status in ['a','b']", { status: "b" })).toBe(true);
    expect(evaluate("not isEmpty(name)", { name: "x" })).toBe(true);
    expect(evaluate("a.b.c", { a: { b: { c: 7 } } })).toBe(7);
    expect(evaluate("x > 1 ? 'big' : 'small'", { x: 5 })).toBe("big");
  });

  it("compares across the type a driver happened to return", () => {
    // Postgres hands DECIMAL back as a string; a rule that stopped firing
    // because of that would be indistinguishable from a rule that is wrong.
    expect(evaluate("total == 10", { total: "10" })).toBe(true);
    expect(evaluate("total >= 10", { total: "10.00" })).toBe(true);
  });

  it("cannot reach the host", () => {
    expect(evaluate("a.__proto__", { a: {} })).toBeUndefined();
    expect(evaluate("a.constructor", { a: {} })).toBeUndefined();
    expect(() => evaluate("globalThis", {})).not.toThrow();
    expect(evaluate("globalThis", {})).toBeUndefined();
  });

  it("raises on syntax it cannot read rather than answering false", () => {
    // Silently returning false would turn a rule nobody can run into a rule
    // that looks like it ran and passed.
    expect(() => evaluate("foo bar baz", {})).toThrow();
    expect(() => evaluate("'unterminated", {})).toThrow();
  });

  it("treats an empty condition as satisfied", () => {
    expect(testExpression("", {})).toBe(true);
    expect(testExpression(null, {})).toBe(true);
  });
});

describe("reading a flowchart's prose decisions", () => {
  const columns = [
    "status",
    "title",
    "estimated_duration_days",
    "anomaly_description",
    "is_active",
  ];

  it("recognises the forms the language's own examples use", () => {
    expect(interpretCondition("Status == draft?", columns).expression).toBe("status == 'draft'");
    expect(interpretCondition("Title provided?", columns).expression).toBe("not isEmpty(title)");
    expect(interpretCondition("Estimated duration days >= 1?", columns).expression).toBe(
      "estimated_duration_days >= 1"
    );
    expect(interpretCondition("anomaly_description length >= 100?", columns).expression).toBe(
      "len(anomaly_description) >= 100"
    );
    expect(interpretCondition("is_active?", columns).expression).toBe("is_active");
  });

  it("reports a decision it cannot read instead of assuming quietly", () => {
    const reading = interpretCondition("GMP-critical experiment?", columns);
    expect(reading.expression).toBeUndefined();
    expect(reading.assumed).toBe(true);
    expect(reading.reason).toContain("GMP-critical experiment");
  });
});

describe("the rules engine", () => {
  const parsed = parseModel(MODEL);

  it("refuses a write the model's rule refuses", async () => {
    const rules = parsed.rules.map((rule) => ({ name: rule.name, jdm_content: rule.jdmContent }));
    const outcome = await evaluateRules(
      rules,
      { status: "draft", reference: "" },
      {
        columns: ["status", "reference", "total"],
      }
    );
    expect(outcome.violations.map((violation: { message: string }) => violation.message)).toContain(
      "Reference Required"
    );
  });

  it("applies the mutation a rule asks for when nothing refused", async () => {
    const rules = parsed.rules.map((rule) => ({ name: rule.name, jdm_content: rule.jdmContent }));
    const outcome = await evaluateRules(
      rules,
      { status: "draft", reference: "ORD-1" },
      {
        columns: ["status", "reference", "total"],
      }
    );
    expect(outcome.violations).toHaveLength(0);
    expect(outcome.mutations.status).toBe("submitted");
  });
});

describe("access control", () => {
  const user = { roles: ["Sales Manager"], isAdmin: false };

  it("matches a model's role spelling against the dictionary's", () => {
    // The model writes `role:sales_manager`; the dictionary seeds "Sales
    // Manager". A restriction that cannot be satisfied by the role it names is
    // not a restriction, it is a lockout.
    expect(holdsRole(user, ["sales_manager"])).toBe(true);
    expect(holdsRole(user, ["sales-manager"])).toBe(true);
    expect(holdsRole(user, ["support_agent"])).toBe(false);
  });

  it("lets an administrator through", () => {
    expect(holdsRole({ roles: [], isAdmin: true }, ["anything"])).toBe(true);
  });

  it("refuses everyone when there is no user", () => {
    expect(holdsRole(null, ["sales_manager"])).toBe(false);
  });
});

describe("naming stays identical to core's", () => {
  // The runtime carries its own copy because it is shipped to a browser, where
  // an `@appwithai/*` import would not resolve. A divergence would give an app
  // URLs that disagree with its own dictionary.
  const samples = ["SalesOrder", "order_line", "CAPA", "StabilityPull", "user"];

  it.each(samples)("%s", (sample) => {
    expect(snakeCase(sample)).toBe(coreSnake(sample));
    expect(kebabCase(sample)).toBe(coreKebab(sample));
    expect(pascalCase(sample)).toBe(corePascal(sample));
  });

  it("prefixes business tables the same way", () => {
    expect(toTableName("SalesOrder")).toBe("bus_sales_order");
    expect(toTableName("bus_order")).toBe("bus_order");
    expect(toTableName("sys_user")).toBe("sys_user");
  });
});

describe("the generated application", () => {
  const parsed = parseModel(MODEL);
  const generated = generateWasmApp(parsed, { ...settings, source: MODEL });

  it("carries the runtime plus exactly the model-shaped files", () => {
    const runtime = new Set(Object.keys(RUNTIME_ASSETS));
    const extra = [...generated.files.keys()].filter((name) => !runtime.has(name));
    expect(extra.sort()).toEqual([
      ".appwithai.json",
      "README.md",
      "app/model.json",
      "app/schema.bus.sql",
      "manual.html",
      "model/model.eml.mmd",
      "package.json",
    ]);
  });

  it("writes a manual describing every entity in the model", () => {
    const manual = generated.files.get("manual.html") ?? "";
    expect(manual).toContain("<title>");
    for (const entity of parsed.entities) {
      // The anchor is the entity name hyphenated at its camel-case seams, the
      // way the manual's own slug() writes it: SupportCase -> support-case.
      const anchor = entity.name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
      expect(manual).toContain(`id="entity-${anchor}"`);
    }
  });

  it("declares a managed column once, however the model spells it", () => {
    /* PostgreSQL refuses `CREATE TABLE` when a column is named twice, so a
       model that declares its own `created_at` used to generate an application
       that could not open its database — the failure arrived as
       `column "created_at" specified more than once`, from a browser tab, with
       nothing pointing back at the model line. The generator's definition wins;
       EML103 tells the author theirs was dropped. */
    const withManaged = `%%meta name: Managed Columns\n%%meta kind: erd\nerDiagram\n    Lesson {\n        string   id PK\n        string   title\n        datetime created_at\n        datetime updated_at OPTIONAL\n        integer  version OPTIONAL\n        string   deleted_by OPTIONAL\n    }\n`;
    const app = generateWasmApp(parseModel([withManaged]), {
      ...settings,
      source: withManaged,
    });
    const schema = app.files.get("app/schema.bus.sql") as string;

    for (const column of ["created_at", "updated_at", "version", "deleted_by", "id"]) {
      const declarations = schema.match(new RegExp(`^\\s*${column}\\s`, "gm")) ?? [];
      expect({ column, times: declarations.length }).toEqual({ column, times: 1 });
    }
    // The generator's own definition is the one that survives.
    expect(schema).toContain("created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()");
    expect(schema).toContain("title ");
  });

  it("collapses a column declared twice, keeping the stronger constraints", () => {
    /* Two lines for one column reached CREATE TABLE as two columns, which
       PostgreSQL refuses — the same crash the managed columns caused. The first
       declaration keeps its place; the constraints merge the other way, so a
       later OPTIONAL cannot quietly relax a column the model said was
       required. */
    const duplicated = `%%meta name: Duplicates\n%%meta kind: erd\nerDiagram\n    Course {\n        string  id PK\n        string  title\n        string  title OPTIONAL\n        string  code OPTIONAL\n        string  code UK\n        integer seats OPTIONAL\n    }\n`;
    const parsed = parseModel([duplicated]);
    const course = parsed.entities[0];

    expect(course?.attributes.map((attribute) => attribute.name)).toEqual([
      "id",
      "title",
      "code",
      "seats",
    ]);
    const by = (name: string) => course?.attributes.find((a) => a.name === name);
    expect(by("title")?.required).toBe(true);
    expect(by("code")?.required).toBe(true);
    expect(by("code")?.unique).toBe(true);
    // A column only ever declared OPTIONAL stays optional.
    expect(by("seats")?.required).toBe(false);

    const app = generateWasmApp(parsed, { ...settings, source: duplicated });
    const schema = app.files.get("app/schema.bus.sql") as string;
    expect(schema.match(/^\s*title\s/gm)).toHaveLength(1);
    expect(schema).toContain("title VARCHAR(255) NOT NULL");
  });

  it("ships the model source so the application can describe itself", () => {
    expect(generated.files.get("model/model.eml.mmd")).toBe(MODEL);
  });

  it("does not put a second copy of the model source in model.json", () => {
    // Spreading the options object once did exactly that, and nothing caught it
    // until a large model doubled every generated application.
    const model = JSON.parse(generated.files.get("app/model.json") as string);
    expect(Object.keys(model.project).sort()).toEqual([
      "adminEmail",
      "adminName",
      "adminPassword",
      "dataKey",
      "description",
      "generatedAt",
      "name",
      "slug",
      "stack",
      "version",
    ]);
  });

  it("names the project in the shell", () => {
    expect(generated.files.get("index.html")).toContain("Test App");
    expect(generated.files.get("index.html")).not.toContain("__PROJECT_NAME__");
  });
});

describe("the model bundle", () => {
  const parsed = parseModel(MODEL);
  const { model, schema } = buildModelBundle(parsed, settings) as {
    model: Record<string, any>;
    schema: string;
  };

  it("emits a table per entity with the managed columns", () => {
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS bus_order (");
    expect(schema).toContain("id UUID PRIMARY KEY DEFAULT gen_random_uuid()");
    expect(schema).toContain("deleted_at TIMESTAMPTZ");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS bus_order_line (");
  });

  it("indexes reference columns", () => {
    expect(schema).toContain("idx_bus_order_line_order_id");
  });

  it("carries the compiled model through", () => {
    expect(model.entities).toHaveLength(2);
    expect(model.rules).toHaveLength(1);
    expect(model.workflows).toHaveLength(1);
    expect(model.rbac.operations).toHaveLength(1);
    expect(model.categories[0].name).toBe("Sales");
  });

  it("gives a %%enum column a list reference so it renders as a dropdown", () => {
    const status = model.entities[0].attributes.find(
      (attribute: { columnName: string }) => attribute.columnName === "status"
    );
    expect(status.referenceId).toBeGreaterThanOrEqual(1000);
    expect(model.enums[0].values).toEqual(["draft", "submitted", "approved"]);
  });

  it("gives each model its own database name", () => {
    // Two applications in one browser share an origin and therefore share
    // IndexedDB. A fixed name meant the second one found the first one's seed
    // marker, skipped its own, and ran the wrong database behind the right
    // model — with no error anywhere.
    const other = parseModel(MODEL.replace("Order {", "Invoice {").replace(/Order/g, "Invoice"));
    const otherBundle = buildModelBundle(other, settings) as { model: Record<string, any> };
    expect(model.project.dataKey).toMatch(/^test-app-[a-z0-9]+$/);
    expect(otherBundle.model.project.dataKey).not.toBe(model.project.dataKey);
  });

  it("reattaches to the same database when the same model is regenerated", () => {
    const again = buildModelBundle(parseModel(MODEL), settings) as { model: Record<string, any> };
    expect(again.model.project.dataKey).toBe(model.project.dataKey);
  });

  it("creates a role for every role a %%rbac directive names", () => {
    // Otherwise the restriction the model wrote can never be satisfied.
    expect(model.roles.map((role: { name: string }) => role.name)).toContain("Sales Manager");
  });

  it("keeps the audit columns out of grids and in the dictionary", () => {
    const gridColumns = model.dictionary.fields
      .filter(
        (field: { tableName: string; isDisplayedGrid: boolean }) =>
          field.tableName === "bus_order" && field.isDisplayedGrid
      )
      .map((field: { columnName: string }) => field.columnName);
    expect(gridColumns).not.toContain("id");
    expect(gridColumns).toContain("reference");
  });
});
