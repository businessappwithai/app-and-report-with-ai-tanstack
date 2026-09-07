import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditorPanel } from "./EditorPanel";
import type { FilterDefinition } from "@/types/database";

interface ChartFilterLink {
  id: string;
  filter_id: string;
  target_column: string;
}

interface ChartReusableFiltersProps {
  availableFilters: FilterDefinition[] | undefined;
  chartFilters: ChartFilterLink[] | undefined;
  availableFields: string[];
  selectedFilterId: string;
  targetColumn: string;
  onSelectedFilterChange: (id: string) => void;
  onTargetColumnChange: (col: string) => void;
  onAddFilter: (filterId: string, targetColumn: string) => void;
  onRemoveFilter: (filterLinkId: string) => void;
  isAdding: boolean;
  isRemoving: boolean;
}

export function ChartReusableFilters({
  availableFilters,
  chartFilters,
  availableFields,
  selectedFilterId,
  targetColumn,
  onSelectedFilterChange,
  onTargetColumnChange,
  onAddFilter,
  onRemoveFilter,
  isAdding,
  isRemoving,
}: ChartReusableFiltersProps) {
  return (
    <EditorPanel
      title="Reusable Filters"
      description="Add pre-configured filters that users can select from dropdowns when viewing the chart."
      contentClassName="space-y-4"
    >
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor="filter-select">Select Filter</Label>
          <Select value={selectedFilterId} onValueChange={onSelectedFilterChange}>
            <SelectTrigger id="filter-select">
              <SelectValue placeholder="Choose a filter..." />
            </SelectTrigger>
            <SelectContent>
              {availableFilters && Array.isArray(availableFilters)
                ? availableFilters
                    .filter((f) => !chartFilters?.some((cf) => cf.filter_id === f.id))
                    .map((filter) => (
                      <SelectItem key={filter.id} value={filter.id}>
                        {filter.name}
                        <span className="text-gray-500 text-xs ml-2">
                          ({filter.display_field} → {filter.value_field})
                        </span>
                      </SelectItem>
                    ))
                : null}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Label htmlFor="target-column">Target Column</Label>
          <Select value={targetColumn} onValueChange={onTargetColumnChange}>
            <SelectTrigger id="target-column">
              <SelectValue placeholder="Select column..." />
            </SelectTrigger>
            <SelectContent>
              {availableFields.map((field) => (
                <SelectItem key={field} value={field}>
                  {field}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => {
            if (selectedFilterId && targetColumn) {
              onAddFilter(selectedFilterId, targetColumn);
            }
          }}
          disabled={!selectedFilterId || !targetColumn || isAdding}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </div>

      {chartFilters && chartFilters.length > 0 && (
        <div className="space-y-2">
          <Label>Active Filters</Label>
          <div className="border rounded-lg divide-y">
            {chartFilters.map((cf) => {
              const filterDef = availableFilters?.find((f) => f.id === cf.filter_id);
              if (!filterDef) return null;
              return (
                <div key={cf.id} className="flex items-center justify-between p-3">
                  <div className="flex-1">
                    <div className="font-medium">{filterDef.name}</div>
                    <div className="text-sm text-gray-500">
                      Filter: <code>{filterDef.display_field}</code> →{" "}
                      <code>{filterDef.value_field}</code> | Target: <code>{cf.target_column}</code>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveFilter(cf.id)}
                    disabled={isRemoving}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {chartFilters?.length === 0 && (
        <div className="text-center py-4 text-gray-500 text-sm">
          No filters added. Add filters above to allow users to filter the chart.
        </div>
      )}
    </EditorPanel>
  );
}
