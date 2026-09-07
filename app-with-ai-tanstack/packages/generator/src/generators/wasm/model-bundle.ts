/**
 * The model, as the browser application consumes it.
 *
 * This is where cli-wasm differs from cli in kind rather than in degree. The
 * NestJS stack compiles a model into ~150 rendered source files: a controller
 * per entity, a service per entity, a migration per concern. That works because
 * something later runs `tsc` over the result — and nothing runs `tsc` in a
 * browser tab. So the browser stack compiles a model into *data*: one
 * `model.json` and one `schema.bus.sql`, read by a runtime that is the same
 * bytes for every model.
 *
 * The consequence is worth stating, because it looks like a shortcut and is
 * not: an application generated here has no per-entity code to diverge from its
 * dictionary, and generation is fast enough and small enough (~200KB, no
 * install step) to happen while someone waits. The cost is that a developer
 * cannot open a generated controller and edit it — for that, the model goes
 * through the NestJS stack, which is why both exist.
 *
 * Every id in this file is a natural key. The seeder resolves `bus_order` to
 * whatever uuid Postgres minted; nothing here invents one, because an id minted
 * on this side and looked up on the other is how a dictionary ends up with
 * fields attached to the wrong tab.
 */

import type { Entity, EntityAttribute, Relationship } from "@appwithai/core/types";
import { ReferenceType } from "@appwithai/core/types";
import type { ParsedModel } from "../../pipeline/generate-application";
import { deriveAccess } from "../../rbac/roles";
import { DictionaryGenerator } from "../dictionary.generator";

export interface WasmProjectSettings {
  name: string;
  version: string;
  description: string;
  adminEmail: string;
  adminPassword: string;
  adminName: string;
}

export interface WasmModelBundle {
  /** `app/model.json` — everything the runtime reads. */
  model: unknown;
  /** `app/schema.bus.sql` — DDL for the model's own tables. */
  schema: string;
}

/** Postgres column type for a modelled attribute. */
export function sqlType(attribute: EntityAttribute): string {
  switch (attribute.type) {
    case "integer":
      return "INTEGER";
    case "decimal":
      return "DECIMAL(18,4)";
    case "boolean":
      return "BOOLEAN";
    case "date":
      return "DATE";
    case "datetime":
      return "TIMESTAMPTZ";
    case "text":
      return "TEXT";
    case "json":
      return "JSONB";
    default:
      return attribute.maxLength ? `VARCHAR(${attribute.maxLength})` : "VARCHAR(255)";
  }
}

/** The reference id that decides how a column renders. */
/** The reference each semantic type alias asks for. */
const SEMANTIC_REFERENCE = {
  email: ReferenceType.EMAIL,
  url: ReferenceType.URL,
  phone: ReferenceType.PHONE,
  password: ReferenceType.PASSWORD,
  color: ReferenceType.COLOR,
} as const;

export function referenceIdFor(attribute: EntityAttribute, isPrimaryKey: boolean): number {
  if (attribute.enumReferenceId) return attribute.enumReferenceId;
  if (isPrimaryKey) return ReferenceType.ID;
  /* Both conditions, as `attributeReferenceId` in @appwithai/core requires and
     as the specification states: the modifier says the column is a reference,
     and the `_id`/`_by` ending is what `refTableFor` resolves the parent table
     from. A column marked FK that ends in neither would take the lookup
     control and have no table to look anything up in. */
  if (attribute.isForeignKey && /(_id|_by)$/.test(attribute.name)) {
    return ReferenceType.TABLE_DIRECT;
  }
  /* The alias the modeller wrote, kept by the parser because `email`, `url`,
     `phone`, `password` and `color` all normalise to `string`. */
  if (attribute.semanticType) return SEMANTIC_REFERENCE[attribute.semanticType];
  /* Failing an alias, the name — for the model that wrote `string email`
     rather than `email email`. Only for a column that could hold an address, a
     number or a link: `boolean email_opt_out` is a checkbox that happens to
     have "email" in its name, and giving it the EMAIL reference put an email
     input in front of a true/false column. */
  if (attribute.type === "string" || attribute.type === "text") {
    if (/email/i.test(attribute.name)) return ReferenceType.EMAIL;
    if (/phone|mobile|tel/i.test(attribute.name)) return ReferenceType.PHONE;
    if (/url|website|link/i.test(attribute.name)) return ReferenceType.URL;
  }

  switch (attribute.type) {
    case "integer":
      return ReferenceType.INTEGER;
    case "decimal":
      return ReferenceType.AMOUNT;
    case "boolean":
      return ReferenceType.YES_NO;
    case "date":
      return ReferenceType.DATE;
    case "datetime":
      return ReferenceType.DATETIME;
    case "text":
      return ReferenceType.TEXT;
    case "json":
      return ReferenceType.JSON;
    default:
      return ReferenceType.STRING;
  }
}

const snake = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();

const kebab = (value: string) => snake(value).replace(/_/g, "-");

/**
 * Label case. An all-caps name is left as it is — a model that declares `CAPA`
 * means the acronym, and titling it to `Capa` renames the entity on screen.
 */
const title = (value: string) =>
  /^[A-Z0-9_]+$/.test(value)
    ? value.replace(/_/g, " ")
    : snake(value)
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");

/** `Order` -> `bus_order`, leaving an already-prefixed name alone. */
export function tableNameFor(entity: Entity): string {
  const base = snake(entity.tableName || entity.name);
  return base.startsWith("bus_") || base.startsWith("sys_") ? base : `bus_${base}`;
}

/**
 * Columns every generated table carries.
 *
 * `id`, the audit columns and `deleted_at` are added by the generator rather
 * than declared in the model, exactly as they are in the NestJS stack, so the
 * two stacks' tables are the same tables. `deleted_at` in particular is what
 * lets the audit trail keep referring to a record after it is deleted.
 */
const MANAGED_COLUMNS = `  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID`;

/**
 * The names the block above occupies, and `id`.
 *
 * A model that declares `datetime created_at` is saying something the generator
 * already guarantees, and emitting both definitions puts the column in the
 * CREATE TABLE twice — which PostgreSQL rejects outright with `column
 * "created_at" specified more than once`, so the application never opens. The
 * declaration is redundant rather than wrong, so the managed definition wins
 * and the model's is dropped; `EML103` tells the author it was.
 */
const MANAGED_COLUMN_NAMES = new Set([
  "id",
  "version",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by",
  "deleted_at",
  "deleted_by",
]);

function buildSchema(entities: Entity[], relationships: Relationship[]): string {
  const lines: string[] = [
    "-- Business tables, generated from the model's erDiagram.",
    "--",
    "-- Foreign keys are added after every table exists, so a model whose entities",
    "-- reference each other in a cycle still applies; declaring them inline would",
    "-- make the order of `erDiagram` blocks decide whether the schema loads.",
    "",
  ];

  for (const entity of entities) {
    const table = tableNameFor(entity);
    const columns = entity.attributes
      .filter((attribute) => !MANAGED_COLUMN_NAMES.has(snake(attribute.name)))
      .map((attribute) => {
        const nullability = attribute.required ? " NOT NULL" : "";
        const unique = attribute.unique ? " UNIQUE" : "";
        return `  ${snake(attribute.name)} ${sqlType(attribute)}${nullability}${unique},`;
      });

    lines.push(`CREATE TABLE IF NOT EXISTS ${table} (`);
    lines.push("  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),");
    lines.push(...columns);
    lines.push(MANAGED_COLUMNS);
    lines.push(");");
    lines.push(`CREATE INDEX IF NOT EXISTS idx_${table}_deleted ON ${table}(deleted_at);`);

    for (const index of entity.indexes ?? []) {
      const name = `idx_${table}_${index.columns.map(snake).join("_")}`;
      const unique = index.unique ? "UNIQUE " : "";
      lines.push(
        `CREATE ${unique}INDEX IF NOT EXISTS ${name} ON ${table}(${index.columns.map(snake).join(", ")});`
      );
    }
    lines.push("");
  }

  lines.push("-- Relationship columns.");
  lines.push("--");
  lines.push("-- A constraint is added only when the column and the key it would point at");
  lines.push("-- are the same type. Models routinely declare a reference as `string pi_id");
  lines.push("-- FK`, which becomes VARCHAR here exactly as it does in the NestJS stack, and");
  lines.push("-- Postgres refuses a VARCHAR->UUID foreign key: emitting it anyway would fail");
  lines.push("-- the whole schema load rather than the one relationship. Every reference");
  lines.push("-- column gets an index regardless, since that is what the joins need.");
  lines.push("");

  const byName = new Map(entities.map((entity) => [entity.name, entity]));
  const constrained = new Set<string>();

  for (const entity of entities) {
    for (const attribute of entity.attributes) {
      if (!attribute.isForeignKey) continue;
      const table = tableNameFor(entity);
      const column = snake(attribute.name);
      lines.push(`CREATE INDEX IF NOT EXISTS idx_${table}_${column} ON ${table}(${column});`);
    }
  }
  lines.push("");

  for (const relationship of relationships) {
    const source = byName.get(relationship.sourceEntity);
    const target = byName.get(relationship.targetEntity);
    if (!source || !target) continue;

    // The column lives on the many side. Its name is derived from the entity it
    // points at rather than taken from `relationship.foreignKey`, because the
    // ERD parser names that after the child (`compound_alias_id` for
    // `Compound ||--o{ CompoundAlias`) while the column the model declares is
    // `compound_id` — named after the parent, as a foreign key is.
    const [owner, referenced] =
      relationship.cardinality === "manyToOne" ? [source, target] : [target, source];

    const candidates = [
      `${snake(referenced.name)}_id`,
      relationship.foreignKey ? snake(relationship.foreignKey) : "",
    ].filter(Boolean);

    for (const column of candidates) {
      const attribute = owner.attributes.find((item) => snake(item.name) === column);
      if (!attribute) continue;
      const key = `${tableNameFor(owner)}.${column}`;
      if (constrained.has(key)) break;
      // `id` is UUID everywhere, so only a UUID column can reference it.
      if (sqlType(attribute) !== "UUID") break;
      constrained.add(key);

      const constraint = `fk_${tableNameFor(owner)}_${column}`;
      lines.push(
        `ALTER TABLE ${tableNameFor(owner)} DROP CONSTRAINT IF EXISTS ${constraint};`,
        `ALTER TABLE ${tableNameFor(owner)} ADD CONSTRAINT ${constraint} ` +
          `FOREIGN KEY (${column}) REFERENCES ${tableNameFor(referenced)}(id) ` +
          `ON DELETE ${relationship.onDelete ?? "SET NULL"};`
      );
      break;
    }
  }

  return `${lines.join("\n")}\n`;
}

/** A short, stable, dependency-free digest. FNV-1a — not a security hash. */
function fingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).padStart(7, "0").slice(0, 7);
}

export function buildModelBundle(
  parsed: ParsedModel,
  project: WasmProjectSettings
): WasmModelBundle {
  const schema = buildSchema(parsed.entities, parsed.relationships);

  const dictionary = new DictionaryGenerator({
    databaseType: "postgresql",
    includeRbac: true,
    randomizeFieldOrder: false,
  }).generateDictionaryContext(parsed.entities, parsed.relationships);

  /* Roles, the accounts that hold them and what each may look at, derived by
     the same function the NestJS build renders into its seed. An application
     whose only account is the administrator cannot show what `%%rbac` did,
     because the administrator bypasses all of it. */
  const access = deriveAccess(parsed.rbac, {
    projectId: kebab(project.name),
    adminEmail: project.adminEmail,
    adminName: project.adminName,
    entities: parsed.entities.map((entity) => entity.name),
  });

  const categoryOf = new Map<string, string>();
  for (const category of parsed.categories) {
    for (const entityName of category.entities) categoryOf.set(entityName, category.name);
  }

  const entities = parsed.entities.map((entity) => {
    const table = tableNameFor(entity);
    return {
      name: entity.name,
      tableName: table,
      routeName: kebab(entity.name),
      displayName: title(entity.name),
      description: entity.description,
      primaryKey: entity.primaryKey,
      category: categoryOf.get(entity.name) ?? "General",
      /* `%%entity <E> parent: <P>`. A child has no window and no dashboard
         card; it is reached as a tab inside its parent. */
      parentEntity: entity.parentEntity,
      parentLinkColumn: entity.parentLinkColumn ? snake(entity.parentLinkColumn) : undefined,
      attributes: entity.attributes.map((attribute, index) => ({
        name: attribute.name,
        columnName: snake(attribute.name),
        displayName: title(attribute.name),
        type: attribute.type,
        sqlType: sqlType(attribute),
        required: !!attribute.required,
        unique: !!attribute.unique,
        maxLength: attribute.maxLength,
        defaultValue: attribute.default == null ? null : String(attribute.default),
        isForeignKey: !!attribute.isForeignKey,
        enumRef: attribute.enumRef,
        enumValues: attribute.enumValues,
        referenceId: referenceIdFor(attribute, attribute.name === entity.primaryKey),
        seqNo: (index + 1) * 10,
      })),
    };
  });

  const tableByTemp = new Map(
    dictionary.sysTables.map((table) => [table._tempId, table.table_name])
  );
  const columnByTemp = new Map(
    dictionary.sysColumns.map((column) => [
      column._tempId,
      { table: tableByTemp.get(column._tableRef) ?? "", column: column.column_name },
    ])
  );
  const tabTable = new Map(
    dictionary.sysTabs.map((tab) => [tab._tempId, tableByTemp.get(tab._tableRef) ?? ""])
  );

  const model = {
    // Spelled out rather than spread. The caller's options object also
    // carries the model source and the PGlite URL, and spreading it once put a
    // second copy of the whole EML document inside model.json — invisible until
    // a large model doubled the size of every generated application.
    project: {
      name: project.name,
      version: project.version,
      description: project.description,
      adminEmail: project.adminEmail,
      adminName: project.adminName,
      adminPassword: project.adminPassword,
      slug: kebab(project.name),
      /**
       * Where this application's database lives, and why it is derived rather
       * than named.
       *
       * Two applications generated in one browser share an origin, so they
       * share IndexedDB. With a fixed name the second one boots, finds the
       * first one's `sys_schema_state.seeded`, skips its own seed and runs the
       * wrong database behind the right model — an application whose rules
       * evaluate against another application's tables, silently.
       *
       * The key covers the schema and the entity names, so regenerating the
       * same model reattaches to its data and a changed model gets a fresh
       * database instead of a half-migrated one.
       */
      dataKey: `${kebab(project.name)}-${fingerprint(schema + parsed.entities.map((e) => e.name).join(","))}`,
      generatedAt: new Date().toISOString(),
      stack: "wasm-browser",
    },
    entities,
    relationships: parsed.relationships,
    categories: parsed.categories.map((category, index) => ({
      name: category.name,
      description: category.description,
      seqNo: (index + 1) * 10,
      entities: category.entities,
    })),
    enums: parsed.enums.map((declared) => ({
      name: declared.name,
      referenceId: declared.referenceId,
      values: declared.values,
    })),
    rules: parsed.rules,
    hooks: parsed.hooks,
    workflows: parsed.workflows,
    sagas: parsed.sagas,
    rbac: parsed.rbac,
    roles: access.roles,
    /* One account per role, seeded with the administrator's password. The
       whole point is that a reader can sign in as a role and see the
       application that role has. */
    users: access.users,
    /* Entity -> the roles whose `read` rule admits it. Empty unless the model
       restricted reading, which is the only operation allowed to narrow what
       the navigation shows. */
    entityVisibility: access.entityVisibility,
    /* Role -> how many entities it may read. The sign-in screen prints it
       beside each account, which is what turns a list of addresses into an
       invitation to compare two roles. */
    entityCounts: access.entityCounts,
    dictionary: {
      references: Object.entries(ReferenceType).map(([name, id]) => ({
        id,
        name: title(name),
        description: `${title(name)} reference type`,
        validationType: id === ReferenceType.LIST ? "L" : id >= 18 && id <= 19 ? "T" : "S",
      })),
      windows: dictionary.sysWindows.map((window) => ({
        name: window.name,
        description: window.description,
        windowType: "maintain",
      })),
      tables: dictionary.sysTables.map((table) => {
        /* The window a table's records are reached through is the window of its
           own tab — not a window sharing its name, which a line item does not
           have. Looking it up by name left every child table pointing at a
           window nobody created, and the tab was then skipped as unseedable. */
        const ownTab = dictionary.sysTabs.find((tab) => tab._tableRef === table._tempId);
        const ownWindow = ownTab
          ? dictionary.sysWindows.find((window) => window._tempId === ownTab._windowRef)
          : undefined;
        return {
          tableName: table.table_name,
          name: table.name,
          description: table.description,
          entityType: "bus",
          accessLevel: table.access_level, // 'S' | 'C' | 'O' | 'CO' | 'A'
          window: ownWindow?.name ?? table.name,
          category: categoryOf.get(entityNameFor(entities, table.table_name)) ?? "General",
        };
      }),
      tabs: dictionary.sysTabs.map((tab) => ({
        tableName: tableByTemp.get(tab._tableRef) ?? "",
        window:
          dictionary.sysWindows.find((window) => window._tempId === tab._windowRef)?.name ??
          tab.name,
        name: tab.name,
        description: tab.description,
        seqNo: tab.seq_no,
        isSingleRow: false,
        /* A detail tab sits at level 1 under its master and links on the
           column that ties the two — see the note in dictionary.generator. */
        tabLevel: tab.tab_level ?? 0,
        linkColumn: tab.link_column_id
          ? dictionary.sysColumns.find((column) => column._tempId === tab.link_column_id)
              ?.column_name
          : undefined,
      })),
      columns: dictionary.sysColumns.map((column) => ({
        tableName: tableByTemp.get(column._tableRef) ?? "",
        columnName: column.column_name,
        name: column.name,
        description: column.description,
        referenceId: column.sys_reference_id,
        isMandatory: column.is_mandatory,
        isUpdateable: column.is_updateable,
        isKey: column.is_key,
        isParent: column.is_parent,
        isIdentifier: column.is_identifier,
        isSelectionColumn: column.is_selection_column,
        fieldLength: column.field_length,
        defaultValue: column.default_value,
        refTableName: refTableFor(
          entities,
          tableByTemp.get(column._tableRef) ?? "",
          column.column_name
        ),
        seqNo: column.seq_no,
      })),
      // No field groups. The dictionary generator produces them, but nothing
      // references one — `sys_field.sys_field_group_id` is left unset in both
      // stacks — so seeding a table of groups no field belongs to would read as
      // a feature the application does not have. The form groups by the label
      // the field carries instead.
      fieldGroups: [] as Array<{ tableName: string; name: string; seqNo: number }>,
      fields: dictionary.sysFields.map((field) => {
        const reference = columnByTemp.get(field._columnRef);
        const tableName = reference?.table ?? tabTable.get(field._tabRef) ?? "";
        const attribute = entities
          .find((entity) => entity.tableName === tableName)
          ?.attributes.find((item) => item.columnName === reference?.column);
        return {
          tableName,
          columnName: reference?.column ?? "",
          name: field.name,
          description: field.description,
          isDisplayed: field.is_displayed,
          // The audit columns are real and queryable but nobody reads a grid to
          // find out who last touched a row; leaving them on makes every table
          // eight columns wider than the model asked for.
          isDisplayedGrid: field.is_displayed_grid && !isNoise(reference?.column ?? ""),
          isReadOnly: field.is_read_only,
          isMandatory: attribute?.required ?? false,
          isUpdateable: true,
          isInsertable: true,
          seqNo: field.seq_no,
          seqNoGrid: field.seq_no_grid,
          fieldType: attribute?.type,
          referenceId: attribute?.referenceId,
          defaultValue: attribute?.defaultValue ?? undefined,
          isKey: attribute?.columnName === "id",
        };
      }),
    },
  };

  return { model, schema };
}

// Columns that are real, queryable and useless in a grid. `id` is a uuid
// nobody reads, and the audit columns would make every table eight columns
// wider than the model asked for. All of them stay on the form.
const NOISE = new Set(["id", "created_by", "updated_by", "deleted_by", "deleted_at", "version"]);
const isNoise = (column: string) => NOISE.has(column);

function entityNameFor(entities: Array<{ name: string; tableName: string }>, tableName: string) {
  return entities.find((entity) => entity.tableName === tableName)?.name ?? tableName;
}

const PERSON_ROLE_COLUMNS = new Set([
  "assigned_to",
  "author_id",
  "lab_manager_id",
  "manager_id",
  "owner_id",
  "pi_id",
  "remediation_owner",
  "remediation_owner_id",
  "user_id",
]);

/** Mirrors isForeignKeyColumnName's person half in @appwithai/core. */
function isPersonRoleColumn(columnName: string): boolean {
  return (
    columnName.endsWith("_by") ||
    columnName.endsWith("_by_id") ||
    PERSON_ROLE_COLUMNS.has(columnName)
  );
}

/** The table a foreign-key column points at, for the form's lookup control. */
function refTableFor(
  entities: Array<{
    name: string;
    tableName: string;
    attributes: Array<{ columnName: string; isForeignKey: boolean }>;
  }>,
  tableName: string,
  columnName: string
): string | undefined {
  const owner = entities.find((entity) => entity.tableName === tableName);
  const attribute = owner?.attributes.find((item) => item.columnName === columnName);
  if (!attribute?.isForeignKey) return undefined;

  /* A person-role column names the role, not a table: `owner_id` and
     `approved_by_id` point at the user entity, and resolving them by prefix
     would look for `bus_owner` and find nothing — which is why those columns
     used to reach the form with no reference table and render as a text box
     asking for a uuid. */
  if (isPersonRoleColumn(columnName)) {
    const user = entities.find(
      (entity) => entity.tableName === "bus_user" || entity.name === "User"
    );
    if (user) return user.tableName;
  }

  const base = columnName.replace(/_id$/, "");
  return entities.find((entity) => entity.tableName === `bus_${base}`)?.tableName;
}
