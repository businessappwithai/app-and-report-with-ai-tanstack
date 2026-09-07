"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { type Virtualizer, useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUISettings } from "@/hooks/useUISettings";
import type { ColumnInfo, SQLExecutionResponse } from "@/types/api";

interface QueryResultsProps {
  result: SQLExecutionResponse | null;
  isLoading?: boolean;
  error?: string | null;
  onPageChange?: (offset: number) => void;
  /** Called when the user clicks/taps a drillable cell */
  onCellClick?: (row: Record<string, unknown>, columnName: string) => void;
  /** Set of column names that support drill-down (cursor + click) */
  drillableColumns?: Set<string>;
}

const ROW_HEIGHT = 40; // Height of each row in pixels

export function QueryResults({
  result,
  isLoading,
  error,
  onPageChange,
  onCellClick,
  drillableColumns,
}: QueryResultsProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const virtualizerRef = useRef<Virtualizer<HTMLDivElement, Element> | null>(null);
  const uiSettings = useUISettings();

  // MEMORY LEAK FIX: Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear virtualizer reference to free memory
      virtualizerRef.current = null;
    };
  }, []);

  // MEMORY LEAK FIX: Clear large data when result changes significantly
  useEffect(() => {
    if (!result) {
      // Force cleanup when no result
      virtualizerRef.current = null;
    }
  }, [result]);

  const columns: ColumnDef<Record<string, unknown>>[] = useMemo(() => {
    if (!result?.columns) return [];

    return result.columns.map((col: ColumnInfo) => ({
      accessorKey: col.name,
      header: ({ column }) => (
        <button
          type="button"
          className="flex items-center gap-1 hover:text-foreground"
          onClick={() => column.toggleSorting()}
        >
          {col.name}
          {column.getIsSorted() === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : column.getIsSorted() === "desc" ? (
            <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-50" />
          )}
        </button>
      ),
      cell: ({ getValue }) => {
        const value = getValue();
        return <CellValue value={value} />;
      },
    }));
  }, [result?.columns]);

  const table = useReactTable({
    data: result?.rows || [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rowModel = table.getRowModel();

  // Set up virtual scrolling with ref for cleanup
  const virtualizer = useVirtualizer({
    count: rowModel.rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10, // Number of rows to render outside viewport
  });

  // Store virtualizer reference for cleanup
  virtualizerRef.current = virtualizer;

  const pagination = result?.pagination;
  const currentPage = pagination ? Math.floor(pagination.offset / pagination.limit) + 1 : 1;
  const hasNextPage = pagination?.hasMore || false;
  const hasPrevPage = pagination ? pagination.offset > 0 : false;

  const handlePreviousPage = useCallback(() => {
    if (hasPrevPage && pagination) {
      onPageChange?.(Math.max(0, pagination.offset - pagination.limit));
    }
  }, [hasPrevPage, pagination, onPageChange]);

  const handleNextPage = useCallback(() => {
    if (hasNextPage && pagination) {
      onPageChange?.(pagination.offset + pagination.limit);
    }
  }, [hasNextPage, pagination, onPageChange]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <div className="text-tremor-content">Executing query...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-destructive rounded-md bg-destructive/10">
        <div className="font-medium text-destructive mb-1">Query Error</div>
        <pre className="text-sm text-destructive whitespace-pre-wrap">{error}</pre>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <Play className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p className="text-sm">Run a query to see results</p>
        </div>
      </div>
    );
  }

  // Calculate total pages
  const totalPages = pagination
    ? Math.ceil((pagination.totalRows || result?.rowCount || 0) / pagination.limit)
    : Math.ceil((result?.rowCount || 0) / 100);

  // Minimum table width so it scrolls horizontally on small screens rather than wrapping
  const minTableWidth = Math.max(columns.length * 120, 480);

  return (
    <div className="space-y-2 flex flex-col h-full">
      {/* Performance Metrics Header */}
      <div className="bg-muted/50 rounded-lg p-2 sm:p-3 flex-shrink-0">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {/* Row counts */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs sm:text-sm py-0.5 sm:py-1">
              {pagination?.totalRows || result.rowCount} row
              {(pagination?.totalRows || result.rowCount) !== 1 ? "s" : ""}
            </Badge>
            {pagination?.serverSide && (
              <Badge
                variant="outline"
                className="text-xs py-0.5"
                title="Data fetched from server in pages"
              >
                Paginated
              </Badge>
            )}
          </div>

          {/* Execution time */}
          <div className="flex items-center gap-1 text-xs sm:text-sm">
            <span className="text-tremor-content">Time:</span>
            <span
              className={
                result.executionTime > 1000
                  ? "text-amber-600 dark:text-amber-400 font-medium"
                  : "text-emerald-600 dark:text-emerald-400 font-medium"
              }
            >
              {result.executionTime}ms
            </span>
          </div>

          {/* Pagination controls */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {currentPage}/{totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={!hasPrevPage}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={!hasNextPage}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {result.truncated && (
          <div className="mt-1.5">
            <Badge variant="warning" className="text-xs">
              Results truncated at limit
            </Badge>
          </div>
        )}
      </div>

      {/* Table — horizontally scrollable on mobile */}
      <div className="flex flex-col flex-1 min-h-0 rounded-md border overflow-hidden">
        {/* Fixed Header — synced scroll via JS not needed; we use a single overflow-x container */}
        <div
          className="flex-shrink-0 bg-background border-b overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
          ref={(el) => {
            // Sync header scroll with body scroll
            if (!el) return;
            const body = el.parentElement?.querySelector<HTMLDivElement>(".table-body-scroll");
            if (!body) return;
            const syncHeader = () => {
              el.scrollLeft = body.scrollLeft;
            };
            body.addEventListener("scroll", syncHeader, { passive: true });
            return () => body.removeEventListener("scroll", syncHeader);
          }}
        >
          <Table
            style={{
              borderCollapse: "separate",
              borderSpacing: "0",
              minWidth: `${minTableWidth}px`,
            }}
          >
            <TableHeader className="bg-background">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="whitespace-nowrap bg-background h-9 text-xs sm:text-sm"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
          </Table>
        </div>

        {/* Scrollable Body */}
        <div ref={tableContainerRef} className="table-body-scroll flex-1 overflow-auto min-h-0">
          {rowModel.rows.length === 0 ? (
            <Table
              style={{
                borderCollapse: "separate",
                borderSpacing: "0",
                minWidth: `${minTableWidth}px`,
              }}
            >
              <TableBody>
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="text-center text-muted-foreground py-8"
                  >
                    No results
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                minWidth: `${minTableWidth}px`,
                position: "relative",
              }}
            >
              <table
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  minWidth: `${minTableWidth}px`,
                  borderCollapse: "separate",
                  borderSpacing: "0",
                  transform: `translateY(${virtualizer.getVirtualItems()[0]?.start ?? 0}px)`,
                }}
                className="caption-bottom text-xs sm:text-sm"
              >
                <tbody>
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const row = rowModel.rows[virtualRow.index];
                    const isEven = virtualRow.index % 2 === 0;
                    return (
                      <TableRow
                        key={virtualRow.key}
                        data-index={virtualRow.index}
                        ref={virtualizer.measureElement}
                        style={{
                          height: `${virtualRow.size}px`,
                          backgroundColor: isEven ? "transparent" : uiSettings.tableRowStripeColor,
                        }}
                      >
                        {row.getVisibleCells().map((cell) => {
                          const colName = cell.column.id;
                          const isDrillable = drillableColumns?.has(colName) ?? false;
                          return (
                            <TableCell
                              key={cell.id}
                              className={`font-mono text-xs sm:text-sm border-b py-1.5 sm:py-2 whitespace-nowrap${isDrillable ? " cursor-pointer hover:bg-accent/60 hover:underline decoration-dotted underline-offset-2 select-none active:bg-accent" : ""}`}
                              style={{ boxSizing: "border-box" }}
                              onClick={
                                isDrillable && onCellClick
                                  ? () => onCellClick(row.original, colName)
                                  : undefined
                              }
                              title={isDrillable ? "Tap to view record" : undefined}
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Performance Info for Large Datasets */}
      {rowModel.rows.length > 100 && (
        <div className="text-xs text-muted-foreground flex-shrink-0">
          💡 Virtual scrolling enabled for {rowModel.rows.length} rows. Only visible rows are
          rendered for optimal performance.
        </div>
      )}
    </div>
  );
}

function CellValue({ value }: { value: unknown }) {
  if (value === null) {
    return <span className="text-muted-foreground italic">NULL</span>;
  }

  if (value === undefined) {
    return <span className="text-muted-foreground italic">undefined</span>;
  }

  if (typeof value === "boolean") {
    return <Badge variant={value ? "success" : "secondary"}>{value.toString()}</Badge>;
  }

  if (typeof value === "object") {
    return <span className="text-xs">{JSON.stringify(value)}</span>;
  }

  const stringValue = String(value);
  if (stringValue.length > 100) {
    return <span title={stringValue}>{stringValue.substring(0, 100)}...</span>;
  }

  return <span>{stringValue}</span>;
}
