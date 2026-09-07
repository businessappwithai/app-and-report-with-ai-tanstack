/**
 * Arrow IPC reader utilities.
 */

import * as Arrow from "apache-arrow";

/**
 * Read an Arrow IPC buffer (stream format) into a Table.
 */
export function readArrowIPC(buffer: Uint8Array): Arrow.Table {
  const reader = Arrow.tableFromIPC(buffer);
  return reader;
}

/**
 * Read an Arrow IPC buffer from a URL.
 */
export async function readArrowFromUrl(url: string): Promise<Arrow.Table> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch Arrow data from ${url}: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return readArrowIPC(new Uint8Array(arrayBuffer));
}
