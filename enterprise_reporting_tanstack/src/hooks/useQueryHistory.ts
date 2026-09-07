'use client'

/**
 * Hook for managing SQL query history with TanStack DB
 * Phase 5: Query history persistence and offline access
 *
 * Stores executed queries in queryHistoryCollection, automatically
 * synced to server via ElectricSQL with optional user toggle.
 */

import { useCallback, useEffect, useState } from 'react'
import { queryHistoryCollection } from '@/lib/tanstack-db/collections'
import type { QueryHistory } from '@/lib/tanstack-db/collections'

export interface QueryHistoryEntry {
  id: string
  sql: string
  executedAt: string
  rowCount: number
  durationMs: number
  error?: string
}

export interface UseQueryHistoryReturn {
  history: QueryHistoryEntry[]
  addQuery: (entry: Omit<QueryHistoryEntry, 'id' | 'executedAt'>) => Promise<void>
  removeQuery: (id: string) => Promise<void>
  clearHistory: () => Promise<void>
  isSyncing: boolean
  saveHistoryToServer: (id: string) => Promise<void>
}

/**
 * Hook for managing query history with TanStack DB
 * Automatically persists and syncs via ElectricSQL
 */
export function useQueryHistory(): UseQueryHistoryReturn {
  const [history, setHistory] = useState<QueryHistoryEntry[]>([])
  const [isSyncing, setIsSyncing] = useState(false)

  // Subscribe to collection changes
  useEffect(() => {
    const subscription = queryHistoryCollection.subscribeChanges(
      (changes) => {
        setHistory((prev) => {
          const map = new Map(prev.map((h) => [h.id, h]))

          for (const change of changes) {
            if (change.type === 'INSERT') {
              map.set(change.key, change.value as QueryHistoryEntry)
            } else if (change.type === 'DELETE') {
              map.delete(change.key)
            }
          }

          // Sort by executedAt descending (newest first)
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()
          )
        })
      },
      { includeInitialState: true }
    )

    return () => subscription.unsubscribe()
  }, [])

  /**
   * Add a new query to history
   * Automatically synced to server
   */
  const addQuery = useCallback(
    async (entry: Omit<QueryHistoryEntry, 'id' | 'executedAt'>) => {
      const newEntry: QueryHistoryEntry = {
        id: crypto.randomUUID(),
        ...entry,
        executedAt: new Date().toISOString(),
      }

      try {
        setIsSyncing(true)
        await queryHistoryCollection.insert(newEntry as any)
      } finally {
        setIsSyncing(false)
      }
    },
    []
  )

  /**
   * Remove a query from history
   */
  const removeQuery = useCallback(async (id: string) => {
    try {
      setIsSyncing(true)
      await queryHistoryCollection.delete(id)
    } finally {
      setIsSyncing(false)
    }
  }, [])

  /**
   * Clear all history
   */
  const clearHistory = useCallback(async () => {
    try {
      setIsSyncing(true)
      for (const entry of history) {
        await queryHistoryCollection.delete(entry.id)
      }
    } finally {
      setIsSyncing(false)
    }
  }, [history])

  /**
   * Save a query to role history (user option)
   * This would sync to a dedicated saved_queries table in the role
   */
  const saveHistoryToServer = useCallback(async (id: string) => {
    const entry = history.find((h) => h.id === id)
    if (!entry) return

    // In production, this would call a server function to save to role history
    // For now, it's a placeholder that persists via ElectricSQL
    try {
      setIsSyncing(true)
      // The entry is already being synced via ElectricSQL
      // Additional processing (like marking as saved) would happen here
    } finally {
      setIsSyncing(false)
    }
  }, [history])

  return {
    history,
    addQuery,
    removeQuery,
    clearHistory,
    isSyncing,
    saveHistoryToServer,
  }
}

/**
 * Get query history entries matching a search query
 */
export function useQueryHistorySearch(history: QueryHistoryEntry[], searchQuery: string) {
  return history.filter((entry) => entry.sql.toLowerCase().includes(searchQuery.toLowerCase()))
}

/**
 * Get recent queries (last N entries)
 */
export function getRecentQueries(history: QueryHistoryEntry[], count: number = 10) {
  return history.slice(0, count)
}

/**
 * Get failed queries (with errors)
 */
export function getFailedQueries(history: QueryHistoryEntry[]) {
  return history.filter((entry) => entry.error)
}
