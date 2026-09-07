/**
 * Schema and seed, run once at first boot.
 *
 * The NestJS stack ships numbered Kysely migration files because that
 * application's database outlives its deployments. This one's database is
 * created by the same page load that creates the server, so migration history
 * would be bookkeeping about a past that cannot exist. What matters instead is
 * that booting twice is not booting twice as much: every statement here is
 * idempotent and the seed is keyed on natural identity, so reopening the tab
 * re-attaches to the existing data rather than duplicating the dictionary.
 *
 * Dictionary rows are linked by natural key — table_name, (table, column),
 * (window, table) — never by an id the generator invented. An id minted on one
 * side and looked up on the other is how a seed ends up with orphaned fields
 * whenever the two sides disagree about ordering.
 */

import { hashPassword } from "./lib/auth.js";

const SCHEMA_VERSION = 1;

export async function migrate(db, model, readAsset, log = () => {}) {
  const already = await db.tableExists("sys_table");

  log("Creating the Application Dictionary schema");
  await db.exec(await readAsset("app/schema.sys.sql"));

  log("Creating business tables");
  await db.exec(await readAsset("app/schema.bus.sql"));

  await db.exec(`
    CREATE TABLE IF NOT EXISTS sys_schema_state (
      key VARCHAR(50) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const seeded = await db.value("SELECT value FROM sys_schema_state WHERE key = 'seeded'");
  if (seeded === String(SCHEMA_VERSION)) {
    log(`Existing database found (${already ? "reattached" : "created"}) — seed skipped`);
    return { seeded: false };
  }

  log("Seeding the dictionary");
  await seedReferences(db, model);
  await seedCategories(db, model);
  await seedDictionary(db, model);
  await seedRoles(db, model);
  await seedAdmin(db, model, log);
  await seedRoleUsers(db, model, log);
  await seedRules(db, model);
  await seedWorkflows(db, model);
  await seedAccess(db, model);
  await seedSampleData(db, model, log);

  await db.query(
    `INSERT INTO sys_schema_state (key, value) VALUES ('seeded', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [String(SCHEMA_VERSION)]
  );

  return { seeded: true };
}

async function seedReferences(db, model) {
  for (const reference of model.dictionary.references || []) {
    await db.query(
      `INSERT INTO sys_reference (sys_reference_id, name, description, validation_type)
       VALUES ($1, $2, $3, $4) ON CONFLICT (sys_reference_id) DO NOTHING`,
      [reference.id, reference.name, reference.description ?? null, reference.validationType ?? "S"]
    );
  }

  // `%%enum` declarations become list references, which is what turns a modelled
  // enum into a dropdown instead of a text box.
  for (const declared of model.enums || []) {
    await db.query(
      `INSERT INTO sys_reference (sys_reference_id, name, description, validation_type)
       VALUES ($1, $2, $3, 'L') ON CONFLICT (sys_reference_id) DO NOTHING`,
      [declared.referenceId, declared.name, `Values declared by %%enum ${declared.name}`]
    );
    let sequence = 0;
    for (const value of declared.values || []) {
      const exists = await db.one(
        "SELECT sys_ref_list_id FROM sys_ref_list WHERE sys_reference_id = $1 AND value = $2",
        [declared.referenceId, value]
      );
      if (exists) continue;
      await db.insert("sys_ref_list", {
        sys_reference_id: declared.referenceId,
        value,
        name: titleize(value),
        seq_no: (sequence += 10),
      });
    }
  }
}

async function seedCategories(db, model) {
  for (const category of model.categories || []) {
    await db.query(
      `INSERT INTO sys_category (name, description, seq_no) VALUES ($1, $2, $3)
         ON CONFLICT (name) DO NOTHING`,
      [category.name, category.description ?? null, category.seqNo ?? 0]
    );
  }
}

async function seedDictionary(db, model) {
  const dictionary = model.dictionary;

  for (const window of dictionary.windows || []) {
    const exists = await db.one("SELECT sys_window_id FROM sys_window WHERE name = $1", [window.name]);
    if (!exists) {
      await db.insert("sys_window", {
        name: window.name,
        description: window.description ?? null,
        window_type: window.windowType ?? "maintain",
      });
    }
  }

  for (const table of dictionary.tables || []) {
    const windowId = table.window
      ? await db.value("SELECT sys_window_id FROM sys_window WHERE name = $1", [table.window])
      : null;
    const categoryId = table.category
      ? await db.value("SELECT sys_category_id FROM sys_category WHERE name = $1", [table.category])
      : null;
    await db.query(
      `INSERT INTO sys_table (table_name, name, description, entity_type, access_level, sys_window_id, sys_category_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (table_name) DO UPDATE
         SET name = EXCLUDED.name, sys_window_id = EXCLUDED.sys_window_id,
             sys_category_id = EXCLUDED.sys_category_id`,
      [
        table.tableName,
        table.name,
        table.description ?? null,
        table.entityType ?? "bus",
        table.accessLevel ?? "A",
        windowId,
        categoryId,
      ]
    );
  }

  for (const column of dictionary.columns || []) {
    const tableId = await db.value("SELECT sys_table_id FROM sys_table WHERE table_name = $1", [
      column.tableName,
    ]);
    if (!tableId) continue;
    await db.query(
      `INSERT INTO sys_column (sys_table_id, column_name, name, description, sys_reference_id,
                               is_mandatory, is_updateable, is_key, is_parent, is_identifier,
                               is_selection_column, field_length, default_value, ref_table_name, seq_no)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (sys_table_id, column_name) DO NOTHING`,
      [
        tableId,
        column.columnName,
        column.name,
        column.description ?? null,
        column.referenceId ?? null,
        !!column.isMandatory,
        column.isUpdateable !== false,
        !!column.isKey,
        !!column.isParent,
        !!column.isIdentifier,
        !!column.isSelectionColumn,
        column.fieldLength ?? null,
        column.defaultValue ?? null,
        column.refTableName ?? null,
        column.seqNo ?? 0,
      ]
    );
  }

  for (const tab of dictionary.tabs || []) {
    const tableId = await db.value("SELECT sys_table_id FROM sys_table WHERE table_name = $1", [tab.tableName]);
    const windowId = await db.value("SELECT sys_window_id FROM sys_window WHERE name = $1", [tab.window]);
    if (!tableId || !windowId) continue;
    const exists = await db.one(
      "SELECT sys_tab_id FROM sys_tab WHERE sys_table_id = $1 AND sys_window_id = $2",
      [tableId, windowId]
    );
    if (exists) continue;
    /* A detail tab links to its master on one column. Resolved here rather
       than carried as an id, because the column rows were inserted above and
       this is the first point at which their ids exist. */
    const linkColumnId = tab.linkColumn
      ? await db.value(
          "SELECT sys_column_id FROM sys_column WHERE sys_table_id = $1 AND column_name = $2",
          [tableId, tab.linkColumn]
        )
      : null;
    await db.insert("sys_tab", {
      sys_table_id: tableId,
      sys_window_id: windowId,
      name: tab.name,
      description: tab.description ?? null,
      seq_no: tab.seqNo ?? 0,
      is_single_row: !!tab.isSingleRow,
      tab_level: tab.tabLevel ?? 0,
      link_column_id: linkColumnId,
    });
    if (linkColumnId) {
      await db.query("UPDATE sys_column SET is_parent = true WHERE sys_column_id = $1", [
        linkColumnId,
      ]);
    }
  }

  for (const group of dictionary.fieldGroups || []) {
    const tabId = await tabIdFor(db, group.tableName);
    if (!tabId) continue;
    const exists = await db.one(
      "SELECT sys_field_group_id FROM sys_field_group WHERE sys_tab_id = $1 AND name = $2",
      [tabId, group.name]
    );
    if (exists) continue;
    await db.insert("sys_field_group", { sys_tab_id: tabId, name: group.name, seq_no: group.seqNo ?? 0 });
  }

  for (const field of dictionary.fields || []) {
    const tabId = await tabIdFor(db, field.tableName);
    if (!tabId) continue;
    const columnId = await db.value(
      `SELECT c.sys_column_id FROM sys_column c
         JOIN sys_table t ON t.sys_table_id = c.sys_table_id
        WHERE t.table_name = $1 AND c.column_name = $2`,
      [field.tableName, field.columnName]
    );
    if (!columnId) continue;
    const groupId = field.fieldGroup
      ? await db.value("SELECT sys_field_group_id FROM sys_field_group WHERE sys_tab_id = $1 AND name = $2", [
          tabId,
          field.fieldGroup,
        ])
      : null;
    await db.query(
      `INSERT INTO sys_field (sys_tab_id, sys_column_id, sys_field_group_id, name, description,
                              is_displayed, is_displayed_grid, is_read_only, is_mandatory,
                              is_updateable, is_insertable, seq_no, seq_no_grid, display_length,
                              field_type, sys_reference_id, default_value, is_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (sys_tab_id, sys_column_id) DO NOTHING`,
      [
        tabId,
        columnId,
        groupId,
        field.name,
        field.description ?? null,
        field.isDisplayed !== false,
        field.isDisplayedGrid !== false,
        !!field.isReadOnly,
        !!field.isMandatory,
        field.isUpdateable !== false,
        field.isInsertable !== false,
        field.seqNo ?? 0,
        field.seqNoGrid ?? 0,
        field.displayLength ?? null,
        field.fieldType ?? null,
        field.referenceId ?? null,
        field.defaultValue ?? null,
        !!field.isKey,
      ]
    );
  }
}

async function tabIdFor(db, tableName) {
  return db.value(
    `SELECT tb.sys_tab_id FROM sys_tab tb
       JOIN sys_table t ON t.sys_table_id = tb.sys_table_id
      WHERE t.table_name = $1 ORDER BY tb.seq_no LIMIT 1`,
    [tableName]
  );
}

async function seedRoles(db, model) {
  for (const role of model.roles || []) {
    await db.query(
      `INSERT INTO sys_role (name, description, is_admin, user_level) VALUES ($1,$2,$3,$4)
         ON CONFLICT (name) DO NOTHING`,
      [role.name, role.description ?? null, !!role.isAdmin, role.userLevel ?? null]
    );
  }
}

/**
 * The administrator the application ships with.
 *
 * Seeded unconditionally and announced in the log, because an application with
 * no way in is not a demonstration of anything. The credentials are generation
 * inputs (`--admin-email`, `--admin-password`), so an app that is going
 * somewhere real can be generated with its own.
 */
async function seedAdmin(db, model, log) {
  const { adminEmail, adminName, adminPassword } = model.project;
  const existing = await db.one("SELECT sys_user_id FROM sys_user WHERE email = $1", [adminEmail]);
  const userId = existing
    ? existing.sys_user_id
    : (
        await db.insert("sys_user", {
          name: adminName,
          email: adminEmail,
          password_hash: await hashPassword(adminPassword),
          description: "Seeded administrator",
        })
      ).sys_user_id;

  const roleId = await db.value("SELECT sys_role_id FROM sys_role WHERE is_admin = true LIMIT 1");
  if (roleId) {
    await db.query(
      `INSERT INTO sys_user_roles (user_id, role_id) VALUES ($1, $2)
         ON CONFLICT (user_id, role_id) DO NOTHING`,
      [userId, roleId]
    );
  }
  log(`Administrator ready: ${adminEmail} / ${adminPassword}`);
}

/**
 * One account per functional role.
 *
 * An application seeded with an administrator and nobody else can only be
 * looked at as an administrator — and the administrator bypasses every rule the
 * model wrote, so the access control it declared is invisible in the only
 * account that exists. Signing in as `sales.rep@…` is what turns `%%rbac` from
 * a claim in a file into something a reader can see: the navigation is shorter,
 * and the entities that are missing are the ones that role does not own.
 *
 * They share the administrator's password on purpose. This is a demonstration
 * database in the reader's own browser, and a screen full of accounts each with
 * a different generated secret is a worse trade than one line of log.
 */
async function seedRoleUsers(db, model, log) {
  const users = (model.users || []).filter((user) => !user.isAdmin);
  if (users.length === 0) return;

  const { adminPassword } = model.project;
  const hash = await hashPassword(adminPassword);
  const seeded = [];

  for (const user of users) {
    const existing = await db.one("SELECT sys_user_id FROM sys_user WHERE email = $1", [
      user.email,
    ]);
    const userId = existing
      ? existing.sys_user_id
      : (
          await db.insert("sys_user", {
            name: user.name,
            email: user.email,
            password_hash: hash,
            description: user.description ?? null,
          })
        ).sys_user_id;

    const roleId = await db.value("SELECT sys_role_id FROM sys_role WHERE name = $1", [
      user.roleName,
    ]);
    /* A user with no role would sign in and see an application with nothing in
       it, which reads as a broken build rather than as a missing seed. */
    if (!roleId) continue;
    await db.query(
      `INSERT INTO sys_user_roles (user_id, role_id) VALUES ($1, $2)
         ON CONFLICT (user_id, role_id) DO NOTHING`,
      [userId, roleId]
    );
    seeded.push(user.email);
  }

  if (seeded.length > 0) {
    log(`${seeded.length} role account(s), password ${adminPassword}: ${seeded.join(", ")}`);
  }
}

/**
 * Sample business rows, when the generator put any in the bundle.
 *
 * They arrive already ordered parent-first and with their foreign keys pointing
 * at ids in the same payload, so a plain insert in key order is enough — no
 * second resolution pass, and no chance of a lookup that opens on nothing.
 *
 * Failure here is reported and swallowed on purpose. Demo data is a
 * convenience; an application that refuses to boot because a sample row was
 * rejected would be a worse trade than one that boots with empty tables.
 */
async function seedSampleData(db, model, log) {
  const tables = Object.entries(model.sampleData || {});
  if (tables.length === 0) return;

  let inserted = 0;
  for (const [table, rows] of tables) {
    for (const row of rows) {
      const columns = Object.keys(row);
      if (columns.length === 0) continue;
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
      try {
        await db.query(
          `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})
             ON CONFLICT DO NOTHING`,
          columns.map((column) => row[column])
        );
        inserted++;
      } catch (error) {
        log(`Sample data: ${table} row skipped — ${error.message}`);
      }
    }
  }
  log(`Sample data: ${inserted} record(s) across ${tables.length} table(s)`);
}

async function seedRules(db, model) {
  for (const rule of model.rules || []) {
    const exists = await db.one("SELECT sys_rule_definition_id FROM sys_rule_definitions WHERE name = $1", [
      rule.name,
    ]);
    if (exists) continue;
    await db.insert("sys_rule_definitions", {
      name: rule.name,
      description: `Compiled from %%rule ${rule.name}`,
      table_name: rule.tableName,
      entity_name: rule.entity,
      event: rule.event,
      operation: rule.operation,
      priority: rule.priority,
      jdm_content: rule.jdmContent,
    });
  }
}

async function seedWorkflows(db, model) {
  for (const workflow of model.workflows || []) {
    const exists = await db.one(
      "SELECT sys_workflow_definition_id FROM sys_workflow_definitions WHERE name = $1",
      [workflow.name]
    );
    if (exists) continue;
    await db.insert("sys_workflow_definitions", {
      name: workflow.name,
      entity_name: workflow.entity,
      kind: "state",
      definition: JSON.stringify(workflow),
    });
  }
  for (const saga of model.sagas || []) {
    const exists = await db.one(
      "SELECT sys_workflow_definition_id FROM sys_workflow_definitions WHERE name = $1",
      [saga.name]
    );
    if (exists) continue;
    await db.insert("sys_workflow_definitions", {
      name: saga.name,
      entity_name: saga.entity,
      kind: "saga",
      definition: JSON.stringify(saga),
    });
  }
}

async function seedAccess(db, model) {
  const rbac = model.rbac || { operations: [], transitions: [] };

  for (const rule of rbac.operations || []) {
    for (const role of rule.roles) {
      await db.query(
        // The casts are load-bearing: a parameter used both in the SELECT list
        // and in a comparison leaves Postgres with two candidate types for it
        // and it refuses the statement rather than choosing.
        `INSERT INTO sys_operation_access (table_name, entity_name, operation, role_name)
         SELECT $1::varchar, $2::varchar, $3::varchar, $4::varchar
          WHERE NOT EXISTS (
            SELECT 1 FROM sys_operation_access
             WHERE table_name=$1::varchar AND operation=$3::varchar AND role_name=$4::varchar)`,
        [rule.tableName, rule.entity, rule.operation, role]
      );
    }
  }

  for (const rule of rbac.transitions || []) {
    for (const edge of rule.edges || []) {
      for (const role of rule.roles) {
        await db.query(
          `INSERT INTO sys_transition_access (table_name, entity_name, transition, from_state, to_state, role_name)
           SELECT $1::varchar, $2::varchar, $3::varchar, $4::varchar, $5::varchar, $6::varchar
            WHERE NOT EXISTS (
              SELECT 1 FROM sys_transition_access
               WHERE table_name=$1::varchar AND transition=$3::varchar AND from_state=$4::varchar
                 AND to_state=$5::varchar AND role_name=$6::varchar)`,
          [rule.tableName, rule.entity, rule.transition, edge.from, edge.to, role]
        );
      }
    }
  }
}

const titleize = (value) =>
  String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
