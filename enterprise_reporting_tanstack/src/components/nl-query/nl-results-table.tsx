"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Download, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface NlResultsTableProps {
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
}

export function NlResultsTable({ columns, rows }: NlResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [displayedRowCount, setDisplayedRowCount] = useState(50);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build column definitions dynamically from query result columns
  const tableColumns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    return columns.map((col) => ({
      accessorKey: col,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 text-xs font-semibold"
        >
          {col}
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ getValue }) => {
        const value = getValue();
        if (value === null || value === undefined) {
          return <span className="text-muted-foreground italic">NULL</span>;
        }
        if (typeof value === "number") {
          return <span className="font-mono text-right">{value.toLocaleString()}</span>;
        }
        if (typeof value === "boolean") {
          return <Badge variant={value ? "default" : "secondary"}>{String(value)}</Badge>;
        }
        const strValue = String(value);
        if (strValue.length > 100) {
          return (
            <span title={strValue} className="truncate max-w-[200px] block">
              {strValue.substring(0, 100)}...
            </span>
          );
        }
        return <span>{strValue}</span>;
      },
    }));
  }, [columns]);

  // Progressively show more rows (infinite scroll)
  const displayedRows = useMemo(() => {
    return rows.slice(0, displayedRowCount);
  }, [rows, displayedRowCount]);

  const table = useReactTable({
    data: displayedRows,
    columns: tableColumns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // Infinite scroll handler
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      if (scrollTop + clientHeight >= scrollHeight - 100) {
        setDisplayedRowCount((prev) => Math.min(prev + 50, rows.length));
      }
    };

    scrollContainer.addEventListener("scroll", handleScroll);
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, [rows.length]);

  const handleExportCsv = () => {
    const csvContent = [
      columns.join(","),
      ...rows.map((row) =>
        columns
          .map((col) => {
            const val = row[col];
            if (val === null || val === undefined) return "";
            const strVal = String(val);
            if (strVal.includes(",") || strVal.includes('"') || strVal.includes("\n")) {
              return `"${strVal.replace(/"/g, '""')}"`;
            }
            return strVal;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `nl-query-results-${Date.now()}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter results..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {displayedRowCount >= rows.length
              ? `${rows.length} rows`
              : `${displayedRowCount} of ${rows.length} rows`}
          </Badge>
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="border rounded-md overflow-auto"
        style={{ maxHeight: "500px" }}
      >
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/95 backdrop-blur z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="text-left px-2 py-1.5 border-b font-semibold whitespace-nowrap"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, idx) => (
              <tr
                key={row.id}
                className={`border-b hover:bg-muted/50 ${idx % 2 === 0 ? "bg-background" : "bg-muted/20"}`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-2 py-1.5 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {displayedRowCount < rows.length && (
          <div className="flex justify-center py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading more rows... ({displayedRowCount}/{rows.length})
          </div>
        )}
      </div>
    </div>
  );
}
