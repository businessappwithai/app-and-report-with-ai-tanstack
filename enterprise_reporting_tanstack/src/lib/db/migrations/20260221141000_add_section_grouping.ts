/**
 * Migration: Add section_name field for visual section grouping
 *
 * This migration adds the `section_name` column to support field
 * grouping with visual separators in dynamically generated forms.
 */

export async function up(db: any): Promise<void> {
  // Check if section_name column already exists
  const exists = await db.schema.hasColumn("metadata_entity_field", "section_name");

  if (!exists) {
    // Add section_name column for grouping fields into visual sections
    await db.schema.alterTable("metadata_entity_field", (table) => {
      table.string("section_name").nullable().after("display_order");
    });

    // Add index for efficient section-based queries
    await db.schema.raw(
      "CREATE INDEX IF NOT EXISTS idx_metadata_entity_field_section ON metadata_entity_field(entity_header_id, section_name, display_order)"
    );
  }
}

export async function down(db: any): Promise<void> {
  // Drop the section index if it exists
  await db.schema.raw("DROP INDEX IF EXISTS idx_metadata_entity_field_section");

  // Remove section_name column if it exists
  const exists = await db.schema.hasColumn("metadata_entity_field", "section_name");
  if (exists) {
    await db.schema.alterTable("metadata_entity_field", (table) => {
      table.dropColumn("section_name");
    });
  }
}
