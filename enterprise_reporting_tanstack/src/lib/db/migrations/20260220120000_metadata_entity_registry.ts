/**
 * Migration: Metadata Entity Registry
 *
 * This migration creates tables for storing and managing metadata for database
 * entities (tables and views) imported from datasources. It enables:
 *
 * 1. Entity metadata registry with business descriptions
 * 2. Field-level metadata with display configuration
 * 3. Foreign key relationship UI configuration
 * 4. Optional datasource editing capabilities
 *
 * Schema Definer Role: Users with 'edit' permission on 'metadata_entity' resources
 * can activate entities, write descriptions, and configure display settings.
 */

export async function up(db: any): Promise<void> {
  // ========================================================================
  // 1. Add is_editable column to data_sources table
  // ========================================================================
  await db.schema.alterTable("data_sources", (table) => {
    table.boolean("is_editable").defaultTo(false).after("is_active");
  });

  // ========================================================================
  // 2. Create metadata_entity_header table
  // ========================================================================
  await db.schema.createTable("metadata_entity_header", (table) => {
    table.string("id", 36).primary().defaultTo(db.raw("(lower(hex(randomblob(16))))"));

    // Foreign key to data_sources
    table
      .string("data_source_id", 36)
      .notNullable()
      .references("id")
      .inTable("data_sources")
      .onDelete("CASCADE");

    // Entity identification (from schema inspection - read-only)
    table.string("entity_name").notNullable(); // Table or view name
    table.string("entity_schema"); // Schema name for pg, mssql
    table.string("entity_type").notNullable().defaultTo("table"); // 'table' or 'view'

    // Schema metadata (from inspection - read-only)
    table.text("schema_metadata").notNullable(); // JSON: complete schema info
    table.timestamp("last_introspected_at").notNullable().defaultTo(db.fn.now());

    // Editable metadata fields
    table.text("description"); // User-provided business description
    table.boolean("is_active").defaultTo(false); // Entity must be activated by schema definer
    table.boolean("is_hidden").defaultTo(true); // Hidden by default until schema definer unhides

    // Audit fields
    table.string("created_by", 36).references("id").inTable("users");
    table.timestamp("created_at").defaultTo(db.fn.now());
    table.timestamp("updated_at").defaultTo(db.fn.now());

    // Unique constraint: one header per entity per datasource
    table.unique(["data_source_id", "entity_name", "entity_schema"]);
  });

  // ========================================================================
  // 3. Create metadata_entity_field table
  // ========================================================================
  await db.schema.createTable("metadata_entity_field", (table) => {
    table.string("id", 36).primary().defaultTo(db.raw("(lower(hex(randomblob(16))))"));

    // Foreign key to entity header
    table
      .string("entity_header_id", 36)
      .notNullable()
      .references("id")
      .inTable("metadata_entity_header")
      .onDelete("CASCADE");

    // Field identification (from schema inspection - read-only)
    table.string("field_name").notNullable(); // Column name
    table.string("data_type").notNullable(); // e.g., "varchar(255)", "integer"
    table.boolean("is_nullable"); // From schema inspection
    table.boolean("is_primary_key").defaultTo(false); // From schema inspection
    table.boolean("is_foreign_key").defaultTo(false); // From schema inspection

    // Foreign key information (from schema inspection - read-only)
    table.string("foreign_key_table"); // Referenced table name
    table.string("foreign_key_column"); // Referenced column name
    table.text("default_value"); // Default value from schema

    // Editable metadata fields
    table.text("description"); // User-provided business description
    table.boolean("is_display_field").defaultTo(false); // Mark as display field in lookups
    table.boolean("is_searchable").defaultTo(true); // Include in search suggestions
    table.integer("display_order"); // UI ordering (drag-and-drop reordering)
    table.string("section_name"); // Group fields into visual sections
    table.string("relationship_ui_type"); // FK UI: 'dropdown', 'popup', 'tab', or NULL

    // Audit fields
    table.timestamp("created_at").defaultTo(db.fn.now());
    table.timestamp("updated_at").defaultTo(db.fn.now());

    // Unique constraint: one field record per field per entity
    table.unique(["entity_header_id", "field_name"]);
  });

  // ========================================================================
  // 4. Create indexes for performance
  // ========================================================================

  // metadata_entity_header indexes
  await db.schema.raw(
    "CREATE INDEX idx_metadata_entity_header_ds ON metadata_entity_header(data_source_id)"
  );
  await db.schema.raw(
    "CREATE INDEX idx_metadata_entity_header_entity ON metadata_entity_header(entity_name)"
  );
  await db.schema.raw(
    "CREATE INDEX idx_metadata_entity_header_type ON metadata_entity_header(entity_type)"
  );
  await db.schema.raw(
    "CREATE INDEX idx_metadata_entity_header_active ON metadata_entity_header(is_active, is_hidden)"
  );

  // metadata_entity_field indexes
  await db.schema.raw(
    "CREATE INDEX idx_metadata_entity_field_header ON metadata_entity_field(entity_header_id)"
  );
  await db.schema.raw(
    "CREATE INDEX idx_metadata_entity_field_name ON metadata_entity_field(field_name)"
  );
  await db.schema.raw(
    "CREATE INDEX idx_metadata_entity_field_display ON metadata_entity_field(is_display_field)"
  );
  await db.schema.raw(
    "CREATE INDEX idx_metadata_entity_field_searchable ON metadata_entity_field(is_searchable)"
  );
  await db.schema.raw(
    "CREATE INDEX idx_metadata_entity_field_fk ON metadata_entity_field(is_foreign_key, foreign_key_table)"
  );
  await db.schema.raw(
    "CREATE INDEX idx_metadata_entity_field_section ON metadata_entity_field(entity_header_id, section_name, display_order)"
  );
}

export async function down(db: any): Promise<void> {
  // Drop in reverse order of creation

  // Drop indexes
  await db.schema.raw("DROP INDEX IF EXISTS idx_metadata_entity_field_section");
  await db.schema.raw("DROP INDEX IF EXISTS idx_metadata_entity_field_fk");
  await db.schema.raw("DROP INDEX IF EXISTS idx_metadata_entity_field_searchable");
  await db.schema.raw("DROP INDEX IF EXISTS idx_metadata_entity_field_display");
  await db.schema.raw("DROP INDEX IF EXISTS idx_metadata_entity_field_name");
  await db.schema.raw("DROP INDEX IF EXISTS idx_metadata_entity_field_header");

  await db.schema.raw("DROP INDEX IF EXISTS idx_metadata_entity_header_active");
  await db.schema.raw("DROP INDEX IF EXISTS idx_metadata_entity_header_type");
  await db.schema.raw("DROP INDEX IF EXISTS idx_metadata_entity_header_entity");
  await db.schema.raw("DROP INDEX IF EXISTS idx_metadata_entity_header_ds");

  // Drop tables
  await db.schema.dropTableIfExists("metadata_entity_field");
  await db.schema.dropTableIfExists("metadata_entity_header");

  // Remove is_editable from data_sources
  await db.schema.alterTable("data_sources", (table) => {
    table.dropColumn("is_editable");
  });
}
