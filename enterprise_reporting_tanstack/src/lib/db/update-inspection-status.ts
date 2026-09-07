/**
 * Update inspection status for data sources based on metadata entities
 * If a data source has metadata entities, it means it has been inspected
 */
import { getDb } from "./config";

export async function updateInspectionStatus(): Promise<void> {
  const db = getDb();

  try {
    // Get all active, non-deleted data sources
    const dataSources = await db
      .selectFrom("data_sources")
      .select("id")
      .where("is_deleted", "=", false)
      .where("is_active", "=", true)
      .execute();

    if (dataSources.length === 0) {
      console.log("[InspectionStatus] No data sources to update");
      return;
    }

    const now = new Date().toISOString();

    // For each data source, check if it has metadata entities
    for (const ds of dataSources) {
      const entityCount = await db
        .selectFrom("metadata_entity_header")
        .select(db.fn.count<number>("id").as("count"))
        .where("data_source_id", "=", ds.id)
        .executeTakeFirstOrThrow();

      const hasEntities = entityCount.count > 0;

      if (hasEntities) {
        // Mark as inspected if it has entities but isn't marked yet
        await (db
          .updateTable("data_sources")
          .set({
            is_inspected: true,
            last_inspected_at: now,
          } as any)
          .where("id", "=", ds.id)
          .where("is_inspected", "=", false)
          .execute() as any);

        console.log(`[InspectionStatus] Updated data source ${ds.id} as inspected`);
      }
    }

    console.log("[InspectionStatus] Inspection status update complete");
  } catch (error) {
    console.error("[InspectionStatus] Error updating inspection status:", error);
  }
}
