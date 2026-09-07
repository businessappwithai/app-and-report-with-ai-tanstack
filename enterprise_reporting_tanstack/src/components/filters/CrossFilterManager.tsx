"use client";

/**
 * Cross-widget filter manager UI.
 * Displays active cross-filters and lets users remove them.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ActiveFilter } from "@/types/filters";

interface CrossFilterManagerProps {
  activeFilters: ActiveFilter[];
  onRemoveFilter: (filterId: string) => void;
  onClearAll: () => void;
}

export function CrossFilterManager({
  activeFilters,
  onRemoveFilter,
  onClearAll,
}: CrossFilterManagerProps) {
  if (activeFilters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground">Active Filters:</span>
      {activeFilters.map((filter) => (
        <Badge key={filter.id} variant="secondary" className="gap-1">
          <span>
            {filter.column} {filter.operator}{" "}
            {filter.values.length === 1
              ? String(filter.values[0])
              : `[${filter.values.join(", ")}]`}
          </span>
          <button
            type="button"
            className="ml-1 text-muted-foreground hover:text-foreground"
            onClick={() => onRemoveFilter(filter.id)}
          >
            ×
          </button>
        </Badge>
      ))}
      <span className="text-tremor-label text-tremor-content">
        {activeFilters.length} filter{activeFilters.length !== 1 ? "s" : ""} applied
      </span>
      <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs" onClick={onClearAll}>
        Clear All
      </Button>
    </div>
  );
}
