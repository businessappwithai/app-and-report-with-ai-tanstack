/**
 * Server-side Parquet export service.
 * Executes a query against a data source and writes the result as a Parquet file.
 */

import { existsSync, statSync, writeFileSync } from "node:fs";
import { nanoid } from "nanoid";
import type { ExportProgress, ParquetExportConfig, ParquetExportResult } from "@/types/wasm";
import type { ColumnSchema } from "@/types/database";
import { rowsToArrowFile } from "./arrow-exporter";
import { estimateRowCount, executeSourceQuery } from "./source-connector";
import { ensureExportDir, getExportPath } from "./storage";

// In-memory progress tracker
const progressMap = new Map<string, ExportProgress>();

/**
 * Export a data source query to a file.
 * Currently writes Arrow IPC (file format) because parquet-wasm is a
 * client-side WASM library. The file can be consumed by DuckDB-Wasm on
 * the client and is functionally equivalent for this pipeline.
 *
 * When a server-side Parquet writer (e.g. parquet-wasm Node build) is
 * added, this function will produce true Parquet files.
 */
export async function exportToParquet(config: ParquetExportConfig): Promise<ParquetExportResult> {
  const exportId = nanoid();
  const startTime = Date.now();

  progressMap.set(exportId, {
    exportId,
    status: "processing",
    progress: 0,
    rowsProcessed: 0,
  });

  try {
    // Estimate size
    const estimatedRows = await estimateRowCount(config.dataSourceId, config.query);

    progressMap.set(exportId, {
      exportId,
      status: "processing",
      progress: 0.1,
      rowsProcessed: 0,
      totalRows: estimatedRows,
    });

    // Execute the query
    const result = await executeSourceQuery(config.dataSourceId, config.query);

    progressMap.set(exportId, {
      exportId,
      status: "processing",
      progress: 0.6,
      rowsProcessed: result.rowCount,
      totalRows: estimatedRows,
    });

    // Convert to Arrow IPC file format
    const arrowBuffer = rowsToArrowFile(result.rows, result.columns);

    // Write to disk
    ensureExportDir();
    const fileName = `${config.outputFileName}_${exportId}.arrow`;
    const filePath = getExportPath(fileName);
    writeFileSync(filePath, arrowBuffer);

    const fileSize = existsSync(filePath) ? statSync(filePath).size : arrowBuffer.byteLength;

    const schema: ColumnSchema[] = result.columns.map((c) => ({
      name: c.name,
      type: c.type,
      nullable: true,
    }));

    const duration = Date.now() - startTime;

    progressMap.set(exportId, {
      exportId,
      status: "completed",
      progress: 1,
      rowsProcessed: result.rowCount,
      totalRows: result.rowCount,
    });

    return {
      id: exportId,
      files: [fileName],
      rowCount: result.rowCount,
      totalSize: fileSize,
      compressionRatio: 1,
      schema,
      duration,
      createdAt: new Date(),
    };
  } catch (err) {
    progressMap.set(exportId, {
      exportId,
      status: "failed",
      progress: 0,
      rowsProcessed: 0,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Get the progress of an export.
 */
export function getExportProgress(exportId: string): ExportProgress | null {
  return progressMap.get(exportId) ?? null;
}

/**
 * Cancel an export (marks as failed).
 */
export function cancelExport(exportId: string): void {
  const progress = progressMap.get(exportId);
  if (progress && progress.status === "processing") {
    progressMap.set(exportId, { ...progress, status: "failed", error: "Cancelled" });
  }
}
