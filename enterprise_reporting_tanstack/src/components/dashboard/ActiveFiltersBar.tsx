"use client";

/**
 * Active filters bar component.
 * Displays currently active cross-widget filters and allows removal.
 */

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { useDashboardState } from "./DashboardState";

export function ActiveFiltersBar() {
  const { activeFilters, removeFilter, clearFilters } = useDashboardState();

  if (!isFeatureEnabled("crossFilterEnabled")) {
    return null;
  }

  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b flex-wrap">
      <span className="text-sm font-medium text-muted-foreground">Active Filters:</span>
      {activeFilters.map((filter) => (
        <Badge key={filter.id} variant="secondary" className="flex items-center gap-1 px-2 py-1">
          <span className="text-xs">
            {filter.column}: {formatFilterValue(filter)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 ml-1"
            onClick={() => removeFilter(filter.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}
      <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
        Clear All
      </Button>
    </div>
  );
}

function formatFilterValue(filter: { values: unknown[]; operator: string }): string {
  if (filter.operator === "range" && filter.values.length === 2) {
    return `${filter.values[0]} - ${filter.values[1]}`;
  }
  if (filter.values.length > 2) {
    return `${filter.values.length} items`;
  }
  return filter.values.map(String).join(", ");
}
