/**
 * Rule Cache Service
 *
 * LRU cache with TTL for rule evaluation performance.
 * Reduces database load and improves evaluation speed.
 *
 * Created by: CORE-007 ticket
 * Week: 2
 */

import { LRUCache } from "lru-cache";
import type { JDMContent } from "./rules.types";

interface CacheEntry {
  jdm: JDMContent;
  timestamp: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
}

/**
 * Rule cache configuration
 */
const CACHE_CONFIG = {
  max: 100, // Maximum number of cached rules
  ttl: 1000 * 60 * 15, // 15 minutes TTL
  allowStale: false,
  updateAgeOnGet: true,
  updateAgeOnHas: true,
} as const;

/**
 * Rule cache service singleton
 *
 * Uses LRU (Least Recently Used) eviction policy with TTL.
 * Keys are formatted as "entityName:operation".
 */
class RuleCacheService {
  private cache: LRUCache<string, CacheEntry>;
  private hits: number = 0;
  private misses: number = 0;

  constructor() {
    this.cache = new LRUCache<string, CacheEntry>({
      max: CACHE_CONFIG.max,
      ttl: CACHE_CONFIG.ttl,
      allowStale: CACHE_CONFIG.allowStale,
      updateAgeOnGet: CACHE_CONFIG.updateAgeOnGet,
      updateAgeOnHas: CACHE_CONFIG.updateAgeOnHas,
    });
  }

  /**
   * Generate cache key from entity name and operation
   */
  private getKey(entityName: string, operation: string): string {
    return `${entityName}:${operation}`;
  }

  /**
   * Get cached rule by entity and operation
   *
   * @param entityName - Entity name (e.g., "Patient")
   * @param operation - Operation type (CREATE, READ, UPDATE, DELETE)
   * @returns Cached JDM content or undefined if not found/expired
   */
  get(entityName: string, operation: string): JDMContent | undefined {
    const key = this.getKey(entityName, operation);
    const entry = this.cache.get(key);

    if (entry) {
      this.hits++;
      return entry.jdm;
    }

    this.misses++;
    return undefined;
  }

  /**
   * Set cached rule
   *
   * @param entityName - Entity name
   * @param operation - Operation type
   * @param jdm - JDM content to cache
   */
  set(entityName: string, operation: string, jdm: JDMContent): void {
    const key = this.getKey(entityName, operation);
    const entry: CacheEntry = {
      jdm,
      timestamp: Date.now(),
    };

    this.cache.set(key, entry);
  }

  /**
   * Check if rule is cached
   *
   * @param entityName - Entity name
   * @param operation - Operation type
   * @returns True if rule exists in cache and is not expired
   */
  has(entityName: string, operation: string): boolean {
    const key = this.getKey(entityName, operation);
    return this.cache.has(key);
  }

  /**
   * Invalidate cached rule
   *
   * @param entityName - Entity name
   * @param operation - Operation type
   */
  invalidate(entityName: string, operation: string): void {
    const key = this.getKey(entityName, operation);
    this.cache.delete(key);
  }

  /**
   * Invalidate all cached rules for an entity
   *
   * @param entityName - Entity name
   */
  invalidateEntity(entityName: string): void {
    const operations = ["CREATE", "READ", "UPDATE", "DELETE", "ALL"];

    for (const operation of operations) {
      this.invalidate(entityName, operation);
    }
  }

  /**
   * Clear all cached rules
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   *
   * @returns Cache statistics including size, hits, misses, and hit rate
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate,
    };
  }

  /**
   * Reset cache (primarily for testing)
   *
   * @internal
   */
  _reset(): void {
    this.clear();
  }
}

// Export singleton instance
export const ruleCache = new RuleCacheService();

// Export class for testing
export { RuleCacheService };

export default ruleCache;
