"use client";

import { ChevronDown, ChevronRight, Eye, Key, Table, Type } from "lucide-react";
import { memo, useState } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ColumnSchema, SchemaInfo, TableInfo, ViewInfo } from "@/types/api";

interface SchemaBrowserProps {
  schema: SchemaInfo | null;
  isLoading?: boolean;
  onTableClick?: (tableName: string) => void;
  onColumnClick?: (tableName: string, columnName: string) => void;
}

function SchemaBrowserComponent({
  schema,
  isLoading,
  onTableClick,
  onColumnClick,
}: SchemaBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [expandedViews, setExpandedViews] = useState<Set<string>>(new Set());

  const toggleTable = (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
  };

  const toggleView = (viewName: string) => {
    const newExpanded = new Set(expandedViews);
    if (newExpanded.has(viewName)) {
      newExpanded.delete(viewName);
    } else {
      newExpanded.add(viewName);
    }
    setExpandedViews(newExpanded);
  };

  const filterItems = <T extends { name: string }>(items: T[]): T[] => {
    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(query));
  };

  const filteredTables = schema ? filterItems(schema.tables) : [];
  const filteredViews = schema ? filterItems(schema.views) : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-tremor-content">Loading schema...</div>
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-2 border-b">
          <Input
            placeholder="Search tables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
            disabled
          />
        </div>
        {/* Empty - schema status shown in bottom panel tabs */}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b">
        <Input
          placeholder="Search tables..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8"
        />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredTables.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                Tables ({filteredTables.length})
              </div>
              {filteredTables.map((table) => (
                <TableItem
                  key={table.name}
                  table={table}
                  isExpanded={expandedTables.has(table.name)}
                  onToggle={() => toggleTable(table.name)}
                  onTableClick={onTableClick}
                  onColumnClick={onColumnClick}
                />
              ))}
            </div>
          )}

          {filteredViews.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                Views ({filteredViews.length})
              </div>
              {filteredViews.map((view) => (
                <ViewItem
                  key={view.name}
                  view={view}
                  isExpanded={expandedViews.has(view.name)}
                  onToggle={() => toggleView(view.name)}
                  onTableClick={onTableClick}
                  onColumnClick={onColumnClick}
                />
              ))}
            </div>
          )}

          {filteredTables.length === 0 && filteredViews.length === 0 && (
            <div className="text-center text-muted-foreground py-4 px-2">
              {/* Empty - warnings shown in the panel below the editor */}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface TableItemProps {
  table: TableInfo;
  isExpanded: boolean;
  onToggle: () => void;
  onTableClick?: (tableName: string) => void;
  onColumnClick?: (tableName: string, columnName: string) => void;
}

const TableItem = memo(function TableItem({
  table,
  isExpanded,
  onToggle,
  onTableClick,
  onColumnClick,
}: TableItemProps) {
  return (
    <div className="mb-1">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggle();
        }}
        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent cursor-pointer"
        onClick={onToggle}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Table className="h-4 w-4 text-blue-500" />
        <span
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              onTableClick?.(table.name);
            }
          }}
          className="text-sm truncate flex-1"
          onClick={(e) => {
            e.stopPropagation();
            onTableClick?.(table.name);
          }}
        >
          {table.name}
        </span>
      </div>

      {isExpanded && (
        <div className="ml-6">
          {table.columns.map((column) => (
            <ColumnItem
              key={column.name}
              column={column}
              tableName={table.name}
              primaryKey={table.primaryKey}
              onClick={onColumnClick}
            />
          ))}
        </div>
      )}
    </div>
  );
});

interface ViewItemProps {
  view: ViewInfo;
  isExpanded: boolean;
  onToggle: () => void;
  onTableClick?: (tableName: string) => void;
  onColumnClick?: (tableName: string, columnName: string) => void;
}

const ViewItem = memo(function ViewItem({
  view,
  isExpanded,
  onToggle,
  onTableClick,
  onColumnClick,
}: ViewItemProps) {
  return (
    <div className="mb-1">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggle();
        }}
        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent cursor-pointer"
        onClick={onToggle}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Eye className="h-4 w-4 text-violet-500" />
        <span
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              onTableClick?.(view.name);
            }
          }}
          className="text-sm truncate flex-1"
          onClick={(e) => {
            e.stopPropagation();
            onTableClick?.(view.name);
          }}
        >
          {view.name}
        </span>
      </div>

      {isExpanded && view.columns.length > 0 && (
        <div className="ml-6">
          {view.columns.map((column) => (
            <ColumnItem
              key={column.name}
              column={column}
              tableName={view.name}
              onClick={onColumnClick}
            />
          ))}
        </div>
      )}
    </div>
  );
});

interface ColumnItemProps {
  column: ColumnSchema;
  tableName: string;
  primaryKey?: string[];
  onClick?: (tableName: string, columnName: string) => void;
}

const ColumnItem = memo(function ColumnItem({
  column,
  tableName,
  primaryKey,
  onClick,
}: ColumnItemProps) {
  const isPrimary = primaryKey?.includes(column.name) || column.isPrimaryKey;

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.(tableName, column.name);
      }}
      className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-accent cursor-pointer text-sm"
      onClick={() => onClick?.(tableName, column.name)}
    >
      {isPrimary ? (
        <Key className="h-3 w-3 text-amber-500" />
      ) : (
        <Type className="h-3 w-3 text-muted-foreground" />
      )}
      <span className={cn("truncate", isPrimary && "font-medium")}>{column.name}</span>
      <span className="text-xs text-muted-foreground ml-auto">{column.type}</span>
      {!column.nullable && <span className="text-xs text-red-500 ml-1">*</span>}
    </div>
  );
});

// Memoize to prevent unnecessary re-renders
export const SchemaBrowser = memo(SchemaBrowserComponent);
