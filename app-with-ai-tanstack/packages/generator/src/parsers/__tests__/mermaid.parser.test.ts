/* eslint-disable @typescript-eslint/no-non-null-assertion -- test assertions: values are guaranteed by test setup */
import { describe, expect, it } from "vitest";
import { MermaidParser } from "../mermaid.parser";

const parser = new MermaidParser();

describe("MermaidParser", () => {
  describe("parse - basic entity", () => {
    it("parses a simple entity with attributes", () => {
      const input = `
erDiagram
  Patient {
    string id PK
    string name
    string email UK
    integer age OPTIONAL
  }
`;
      const { entities } = parser.parse(input);

      expect(entities).toHaveLength(1);
      const patient = entities[0]!;
      expect(patient.name).toBe("Patient");
      expect(patient.tableName).toBe("patient");
      expect(patient.primaryKey).toBe("id");
      expect(patient.timestamps).toBe(true);
    });

    it("converts PascalCase entity name to snake_case table name", () => {
      const input = `erDiagram\n  PatientRecord {\n    string id PK\n  }`;
      const { entities } = parser.parse(input);
      expect(entities[0]?.tableName).toBe("patient_record");
    });

    it("auto-adds id attribute when not present", () => {
      const input = `erDiagram\n  Product {\n    string name\n    decimal price\n  }`;
      const { entities } = parser.parse(input);
      const product = entities[0]!;
      const idAttr = product.attributes.find((a) => a.name === "id");
      expect(idAttr).toBeDefined();
      expect(idAttr?.unique).toBe(true);
    });

    it("does not duplicate id when already present", () => {
      const input = `erDiagram\n  User {\n    string id PK\n    string name\n  }`;
      const { entities } = parser.parse(input);
      const idAttrs = entities[0]?.attributes.filter((a) => a.name === "id");
      expect(idAttrs).toHaveLength(1);
    });

    it("parses multiple entities", () => {
      const input = `
erDiagram
  Customer {
    string id PK
    string name
  }
  Order {
    string id PK
    string status
  }
`;
      const { entities } = parser.parse(input);
      expect(entities).toHaveLength(2);
      expect(entities.map((e) => e.name)).toEqual(["Customer", "Order"]);
    });
  });

  describe("parse - attribute types", () => {
    it("maps Mermaid types to standard types", () => {
      const input = `
erDiagram
  TypeTest {
    string name
    varchar email
    int count
    integer total
    decimal price
    float weight
    bool active
    boolean verified
    date birthday
    datetime createdAt
    json metadata
    uuid userId
  }
`;
      const { entities } = parser.parse(input);
      const attrs = entities[0]!.attributes.reduce<Record<string, string>>((map, a) => {
        map[a.name] = a.type;
        return map;
      }, {});

      expect(attrs.name).toBe("string");
      expect(attrs.email).toBe("string");
      expect(attrs.count).toBe("integer");
      expect(attrs.total).toBe("integer");
      expect(attrs.price).toBe("decimal");
      expect(attrs.weight).toBe("decimal");
      expect(attrs.active).toBe("boolean");
      expect(attrs.verified).toBe("boolean");
      expect(attrs.birthday).toBe("date");
      expect(attrs.createdAt).toBe("datetime");
      expect(attrs.metadata).toBe("json");
      expect(attrs.userId).toBe("string"); // uuid → string
    });

    it("sets required=true by default, false for OPTIONAL", () => {
      const input = `
erDiagram
  Item {
    string id PK
    string name
    string notes OPTIONAL
  }
`;
      const { entities } = parser.parse(input);
      const attrs = entities[0]!.attributes;
      const name = attrs.find((a) => a.name === "name");
      const notes = attrs.find((a) => a.name === "notes");
      expect(name?.required).toBe(true);
      expect(notes?.required).toBe(false);
    });

    it("sets unique=true for UK modifier", () => {
      const input = `erDiagram\n  User {\n    string id PK\n    string email UK\n    string name\n  }`;
      const { entities } = parser.parse(input);
      const email = entities[0]?.attributes.find((a) => a.name === "email");
      expect(email?.unique).toBe(true);

      const name = entities[0]?.attributes.find((a) => a.name === "name");
      expect(name?.unique).toBeFalsy();
    });
  });

  describe("parse - relationships", () => {
    it("parses one-to-many relationship", () => {
      const input = `
erDiagram
  Customer ||--o{ Order : places
`;
      const { relationships } = parser.parse(input);
      expect(relationships).toHaveLength(1);
      expect(relationships[0]?.cardinality).toBe("oneToMany");
      expect(relationships[0]?.sourceEntity).toBe("Customer");
      expect(relationships[0]?.targetEntity).toBe("Order");
    });

    it("parses many-to-one relationship", () => {
      const input = `erDiagram\n  Order }o--|| Customer : belongs`;
      const { relationships } = parser.parse(input);
      expect(relationships[0]?.cardinality).toBe("manyToOne");
    });

    it("parses one-to-one relationship", () => {
      const input = `erDiagram\n  User ||--|| Profile : has`;
      const { relationships } = parser.parse(input);
      expect(relationships[0]?.cardinality).toBe("oneToOne");
    });

    it("parses many-to-many relationship", () => {
      const input = `erDiagram\n  Student }o--o{ Course : enrolls`;
      const { relationships } = parser.parse(input);
      expect(relationships[0]?.cardinality).toBe("manyToMany");
    });

    it("parses multiple relationships", () => {
      const input = `
erDiagram
  Customer ||--o{ Order : places
  Order ||--o{ OrderItem : contains
  OrderItem }o--|| Product : references
`;
      const { relationships } = parser.parse(input);
      expect(relationships).toHaveLength(3);
    });

    it("parses relationship name from label", () => {
      const input = `erDiagram\n  Doctor ||--o{ Appointment : schedules`;
      const { relationships } = parser.parse(input);
      expect(relationships[0]?.name).toBe("schedules");
    });
  });

  describe("parse - combined entities and relationships", () => {
    it("parses a full ERD diagram", () => {
      const input = `
erDiagram
  Customer {
    string id PK
    string name
    string email UK
  }
  Order {
    string id PK
    string customer_id FK
    string status
    decimal total
  }
  Customer ||--o{ Order : places
`;
      const { entities, relationships } = parser.parse(input);
      expect(entities).toHaveLength(2);
      expect(relationships).toHaveLength(1);
      expect(entities.map((e) => e.name)).toContain("Customer");
      expect(entities.map((e) => e.name)).toContain("Order");
    });

    it("handles CRLF line endings", () => {
      const input = "erDiagram\r\n  User {\r\n    string id PK\r\n    string name\r\n  }\r\n";
      const { entities } = parser.parse(input);
      expect(entities).toHaveLength(1);
      expect(entities[0]?.name).toBe("User");
    });

    it("skips comments starting with %%", () => {
      const input = `
erDiagram
  %% This is a comment
  Patient {
    string id PK
  }
  %% Another comment
`;
      const { entities } = parser.parse(input);
      expect(entities).toHaveLength(1);
    });

    it("returns empty arrays for blank input", () => {
      const { entities, relationships } = parser.parse("");
      expect(entities).toHaveLength(0);
      expect(relationships).toHaveLength(0);
    });

    it("returns empty arrays for erDiagram header only", () => {
      const { entities, relationships } = parser.parse("erDiagram");
      expect(entities).toHaveLength(0);
      expect(relationships).toHaveLength(0);
    });
  });
});
