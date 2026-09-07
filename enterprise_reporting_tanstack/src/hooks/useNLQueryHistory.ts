"use client";

/**
 * Hook for managing NL (natural language) query history as a user option
 * Allows users to save generated NL queries to role history
 * Can be toggled on/off per user preference
 */

import { useCallback, useState } from "react";
import { queryHistoryCollection } from "@/lib/tanstack-db/collections";

export interface NLQueryEntry {
  id: string;
  sql: string;
  nlPrompt: string;
  executedAt: string;
  rowCount: number;
  durationMs: number;
  savedToRole: boolean;
  error?: string;
}

export interface UseNLQueryHistoryReturn {
  saveNLQuery: (entry: Omit<NLQueryEntry, "id" | "executedAt" | "savedToRole">) => Promise<void>;
  toggleSaveToRole: (id: string, save: boolean) => Promise<void>;
  getSavedNLQueries: () => Promise<NLQueryEntry[]>;
  isSavingPreference: boolean;
}

/**
 * Hook for NL query history with per-user save preference
 * Integrates with TanStack DB for persistence and sync
 */
export function useNLQueryHistory(): UseNLQueryHistoryReturn {
  const [isSavingPreference, setIsSavingPreference] = useState(false);

  /**
   * Save an NL query to history
   * User can opt to save to role history
   */
  const saveNLQuery = useCallback(
    async (entry: Omit<NLQueryEntry, "id" | "executedAt" | "savedToRole">) => {
      const newEntry = {
        id: crypto.randomUUID(),
        ...entry,
        executedAt: new Date().toISOString(),
        savedToRole: false, // User can toggle this later
      };

      try {
        setIsSavingPreference(true);
        // Store in query history as regular entry
        // User preference to save to role is tracked separately
        await queryHistoryCollection.insert({
          id: newEntry.id,
          sql: newEntry.sql,
          executedAt: newEntry.executedAt,
          rowCount: newEntry.rowCount,
          durationMs: newEntry.durationMs,
          error: newEntry.error,
        } as any);
      } finally {
        setIsSavingPreference(false);
      }
    },
    []
  );

  /**
   * Toggle user preference to save query to role history
   * This would trigger saving to a role-level history table
   */
  const toggleSaveToRole = useCallback(async (id: string, save: boolean) => {
    try {
      setIsSavingPreference(true);

      if (save) {
        // Call server function to save query to role history
        // This would typically create an entry in a role-specific history table
        // and increment usage metrics for the role
        const response = await fetch("/api/queries/save-to-role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ queryId: id }),
        });

        if (!response.ok) {
          throw new Error("Failed to save query to role history");
        }
      }
    } finally {
      setIsSavingPreference(false);
    }
  }, []);

  /**
   * Get queries that user has saved to role history
   */
  const getSavedNLQueries = useCallback(async (): Promise<NLQueryEntry[]> => {
    try {
      const response = await fetch("/api/queries/role-history");
      if (!response.ok) return [];
      const data = await response.json();
      return data.data || [];
    } catch {
      return [];
    }
  }, []);

  return {
    saveNLQuery,
    toggleSaveToRole,
    getSavedNLQueries,
    isSavingPreference,
  };
}

/**
 * Component hook for NL query UI toggle
 * Provides user preference state and toggle
 */
export function useNLQuerySavePreference() {
  const [saveToRoleHistory, setSaveToRoleHistory] = useState(false);
  const [isCheckingPreference, setIsCheckingPreference] = useState(false);

  /**
   * Check user's saved preference from server
   */
  const loadPreference = useCallback(async () => {
    try {
      setIsCheckingPreference(true);
      const response = await fetch("/api/user/nl-query-preference");
      if (response.ok) {
        const data = await response.json();
        setSaveToRoleHistory(data.saveToRoleHistory || false);
      }
    } finally {
      setIsCheckingPreference(false);
    }
  }, []);

  /**
   * Save user preference to server
   */
  const updatePreference = useCallback(async (save: boolean) => {
    try {
      setIsCheckingPreference(true);
      const response = await fetch("/api/user/nl-query-preference", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saveToRoleHistory: save }),
      });

      if (response.ok) {
        setSaveToRoleHistory(save);
      }
    } finally {
      setIsCheckingPreference(false);
    }
  }, []);

  return {
    saveToRoleHistory,
    updatePreference,
    isCheckingPreference,
    loadPreference,
  };
}
