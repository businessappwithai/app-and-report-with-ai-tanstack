"use client";

/**
 * Dropdown selector for choosing a loaded dataset (DuckDB table).
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DatasetInfo } from "@/types/datasets";

interface DatasetSelectorProps {
  datasets: DatasetInfo[];
  value?: string;
  onValueChange: (datasetId: string) => void;
  placeholder?: string;
}

export function DatasetSelector({
  datasets,
  value,
  onValueChange,
  placeholder = "Select dataset…",
}: DatasetSelectorProps) {
  const loaded = datasets.filter((d) => !d.isLoading && d.memorySize > 0);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[240px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {loaded.length === 0 ? (
          <SelectItem value="__none" disabled>
            No datasets loaded
          </SelectItem>
        ) : (
          loaded.map((ds) => (
            <SelectItem key={ds.id} value={ds.id}>
              {ds.name} ({ds.rowCount.toLocaleString()} rows)
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
