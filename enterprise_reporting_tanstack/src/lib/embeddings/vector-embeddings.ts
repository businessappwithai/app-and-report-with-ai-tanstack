/**
 * Vector embeddings for logs using pgvector
 * Generates semantic embeddings for log messages for similarity search
 */

/**
 * Generate a simple vector embedding from text
 * For production, this would use OpenAI or similar API
 * This version uses word-based approach for better semantic similarity
 */
export function generateTextEmbedding(text: string): number[] {
  // Create a 1536-dimensional vector (OpenAI embedding size)
  const vector = new Array(1536).fill(0);

  const normalized = text.toLowerCase().trim();

  // Extract words and split into tokens
  const words = normalized.split(/\s+/);
  const tokens = new Set<string>();

  // Add individual words
  words.forEach((word) => {
    tokens.add(word);
    // Add character 2-grams for better matching
    for (let i = 0; i < word.length - 1; i++) {
      tokens.add(word.substring(i, i + 2));
    }
  });

  // Convert tokens to vector dimensions
  tokens.forEach((token) => {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    // Use hash to distribute token across dimensions
    const absHash = Math.abs(hash);
    const primaryIndex = absHash % 1536;
    const weight = 0.2;

    // Add the token weight to primary index
    vector[primaryIndex] += weight;

    // Add to nearby indices for smoother distribution
    vector[(primaryIndex + 1) % 1536] += weight * 0.5;
    vector[(primaryIndex - 1 + 1536) % 1536] += weight * 0.5;
  });

  // Normalize the vector to unit length
  let magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) magnitude = 1;

  return vector.map((val) => val / magnitude);
}

/**
 * Generate embeddings for log message and metadata combined
 */
export function generateLogEmbedding(
  message: string,
  component: string,
  level: string,
  metadata?: Record<string, unknown>
): number[] {
  // Combine all text for embedding
  let combinedText = `[${level}] ${component}: ${message}`;

  if (metadata) {
    const metadataStr = Object.entries(metadata)
      .map(([key, value]) => {
        if (typeof value === "object") {
          return `${key}:${JSON.stringify(value).substring(0, 100)}`;
        }
        return `${key}:${String(value).substring(0, 50)}`;
      })
      .join(" ");
    combinedText += ` ${metadataStr}`;
  }

  return generateTextEmbedding(combinedText);
}

/**
 * Calculate cosine similarity between two vectors
 * Used for finding similar logs
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  for (let i = 0; i < Math.min(vec1.length, vec2.length); i++) {
    dotProduct += vec1[i] * vec2[i];
    mag1 += vec1[i] * vec1[i];
    mag2 += vec2[i] * vec2[i];
  }

  mag1 = Math.sqrt(mag1);
  mag2 = Math.sqrt(mag2);

  if (mag1 === 0 || mag2 === 0) return 0;

  return dotProduct / (mag1 * mag2);
}
