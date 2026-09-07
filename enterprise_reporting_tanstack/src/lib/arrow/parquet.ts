/**
 * Parquet-specific utilities for client-side Parquet reading.
 */

/**
 * Fetch a Parquet file from a URL as a Uint8Array buffer.
 * Supports progress tracking via callback.
 */
export async function fetchParquetBuffer(
  url: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch Parquet file from ${url}: ${response.statusText}`);
  }

  const contentLength = response.headers.get("content-length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  if (!response.body) {
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress?.(loaded, total);
  }

  const result = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result;
}

/**
 * Get the file size of a remote Parquet file via a HEAD request.
 */
export async function getParquetFileSize(url: string): Promise<number> {
  const response = await fetch(url, { method: "HEAD" });
  const contentLength = response.headers.get("content-length");
  return contentLength ? parseInt(contentLength, 10) : 0;
}
