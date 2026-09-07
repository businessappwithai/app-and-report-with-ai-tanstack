/**
 * Arrow IPC writer utilities.
 */

import * as Arrow from "apache-arrow";

/**
 * Serialize an Arrow Table to IPC stream format (Uint8Array).
 */
export function writeArrowIPC(table: Arrow.Table): Uint8Array {
  return Arrow.tableToIPC(table, "stream");
}

/**
 * Serialize an Arrow Table to IPC file format (Uint8Array).
 */
export function writeArrowFile(table: Arrow.Table): Uint8Array {
  return Arrow.tableToIPC(table, "file");
}
