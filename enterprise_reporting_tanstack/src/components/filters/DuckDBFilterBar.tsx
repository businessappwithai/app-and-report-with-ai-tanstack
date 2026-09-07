"use client";

/**
 * DuckDB-aware filter bar.
 * Allows building WHERE clauses that execute against DuckDB-Wasm.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ColumnSchema, TableFilterState } from "@/types/filters";

interface DuckDBFilterBarProps {
  columns: ColumnSchema[];
  onApply: (filters: TableFilterState[]) => void;
  onClear: () => void;
}

const OPERATORS = [
  { value: "eq", label: "=" },
  { value: "ne", label: "!=" },
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "gte", label: ">=" },
  { value: "lte", label: "<=" },
  { value: "contains", label: "contains" },
  { value: "startsWith", label: "starts with" },
] as const;

export function DuckDBFilterBar({ columns, onApply, onClear }: DuckDBFilterBarProps) {
  const [filters, setFilters] = useState<TableFilterState[]>([]);
  const [column, setColumn] = useState<string>("");
  const [operator, setOperator] = useState<string>("eq");
  const [value, setValue] = useState<string>("");

  const addFilter = () => {
    if (!column || !value) return;
    const newFilter: TableFilterState = {
      columnId: column,
      operator: operator as TableFilterState["operator"],
      value,
    };
    const updated = [...filters, newFilter];
    setFilters(updated);
    onApply(updated);
    setColumn("");
    setValue("");
  };

  const removeFilter = (index: number) => {
    const updated = filters.filter((_, i) => i !== index);
    setFilters(updated);
    onApply(updated);
  };

  const clearAll = () => {
    setFilters([]);
    onClear();
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Select value={column} onValueChange={setColumn}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Column" />
          </SelectTrigger>
          <SelectContent>
            {columns.map((c) => (
              <SelectItem key={c.name} value={c.name}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={operator} onValueChange={setOperator}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPERATORS.map((op) => (
              <SelectItem key={op.value} value={op.value}>
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Value"
          className="w-[160px]"
          onKeyDown={(e) => e.key === "Enter" && addFilter()}
        />

        <Button size="sm" onClick={addFilter}>
          Add
        </Button>
        {filters.length > 0 && (
          <Button size="sm" variant="outline" onClick={clearAll}>
            Clear
          </Button>
        )}
      </div>

      {filters.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {filters.map((f) => (
            <span
              key={f.columnId + f.operator + String(f.value)}
              className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs"
            >
              {f.columnId} {f.operator} {String(f.value)}
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => removeFilter(i)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
