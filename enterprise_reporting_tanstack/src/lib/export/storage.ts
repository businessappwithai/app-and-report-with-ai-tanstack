/**
 * File storage management for exported Parquet/Arrow files.
 */

import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

const EXPORT_DIR = process.env.DATASET_EXPORT_PATH || "./data/exports";

/**
 * Ensure the export directory exists.
 */
export function ensureExportDir(): string {
  if (!existsSync(EXPORT_DIR)) {
    mkdirSync(EXPORT_DIR, { recursive: true });
  }
  return EXPORT_DIR;
}

/**
 * Get the full path for an export file.
 */
export function getExportPath(fileName: string): string {
  return path.join(ensureExportDir(), fileName);
}

/**
 * Delete an export file.
 */
export function deleteExportFile(fileName: string): void {
  const filePath = getExportPath(fileName);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

/**
 * List all export files in the directory.
 */
export function listExportFiles(): { name: string; size: number; modified: Date }[] {
  const dir = ensureExportDir();
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((f) => f.endsWith(".parquet") || f.endsWith(".arrow"))
    .map((name) => {
      const st = statSync(path.join(dir, name));
      return { name, size: st.size, modified: st.mtime };
    });
}

/**
 * Clean up export files older than a given date.
 */
export function cleanupExports(olderThan: Date): number {
  const files = listExportFiles();
  let deleted = 0;
  for (const file of files) {
    if (file.modified < olderThan) {
      deleteExportFile(file.name);
      deleted++;
    }
  }
  return deleted;
}
