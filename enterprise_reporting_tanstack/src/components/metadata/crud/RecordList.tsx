/**
 * Record List Component
 *
 * Displays paginated entity data records using TanStack Table.
 * Uses server-side pagination.
 */

"use client";

import {
  type ColumnDef,
  getCoreRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { Edit, Loader2, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEntityRecords } from "@/hooks/metadata/use-metadata-queries";
import type { MetadataEntityWithFields } from "@/types/database";

interface RecordListProps {
  dataSourceId: string;
  entity: MetadataEntityWithFields;
  onEditRecord?: (recordId: string | number, record: Record<string, unknown>) => void;
  onDeleteRecord?: (recordId: string | number) => void;
  onCreateRecord?: () => void;
}

export function RecordList({
  dataSourceId,
  entity,
  onEditRecord,
  onDeleteRecord,
  onCreateRecord,
}: RecordListProps) {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");

  // Query records
  const { data, isLoading, isError, error } = useEntityRecords(dataSourceId, entity.id, {
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    search: search || undefined,
    sort: sorting[0]?.id,
    order: sorting[0]?.desc ? "desc" : "asc",
  });

  const records = data?.data?.records || [];
  const total = data?.data?.total || 0;
  const pageCount = data?.data?.pageCount || 0;

  // Generate columns from entity fields
  const columns = useMemo(() => {
    const cols: ColumnDef<Record<string, unknown>>[] = [];

    // Get display fields
    const displayFields = entity.fields
      .filter((f) => f.is_display_field || f.is_primary_key)
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

    for (const field of displayFields) {
      cols.push({
        accessorKey: field.field_name,
        header: field.description || field.field_name,
        cell: ({ row }) => {
          const value = row.getValue(field.field_name);
          return formatCellValue(value, field.data_type);
        },
      });
    }

    // Actions column
    cols.push({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const pkField = entity.fields.find((f) => f.is_primary_key);
        const recordId = pkField ? (row.getValue(pkField.field_name) as string | number) : null;

        return (
          <div className="flex items-center gap-2">
            {onEditRecord && recordId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEditRecord(recordId, row.original)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onDeleteRecord && recordId && (
              <Button variant="ghost" size="sm" onClick={() => onDeleteRecord(recordId)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        );
      },
    });

    return cols;
  }, [entity.fields, onEditRecord, onDeleteRecord]);

  const table = useReactTable({
    data: records,
    columns,
    pageCount,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{entity.entity_name} Records</CardTitle>
            <CardDescription>
              {total} {total === 1 ? "record" : "records"} found
            </CardDescription>
          </div>
          {onCreateRecord && <Button onClick={onCreateRecord}>Create Record</Button>}
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search records..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Page Size */}
          <Select
            value={String(pagination.pageSize)}
            onValueChange={(val) => setPagination({ ...pagination, pageSize: Number(val) })}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-destructive mb-2">Error loading records</p>
            <p className="text-tremor-default text-tremor-content">{error?.message}</p>
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground mb-2">No records found</p>
            {onCreateRecord && (
              <Button variant="outline" size="sm" onClick={onCreateRecord}>
                Create First Record
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : header.column.columnDef.header?.toString()}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={(row.original as any).id || JSON.stringify(row.original)}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="text-tremor-default text-tremor-content">
              Showing {pagination.pageIndex * pagination.pageSize + 1} to{" "}
              {Math.min((pagination.pageIndex + 1) * pagination.pageSize, total)} of {total} records
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                First
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.setPageIndex(pageCount - 1)}
                disabled={!table.getCanNextPage()}
              >
                Last
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatCellValue(value: unknown, _dataType: string): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">null</span>;
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "object") {
    return <span className="text-xs">{JSON.stringify(value)}</span>;
  }

  if (typeof value === "string" && value.length > 100) {
    return <span className="text-xs">{value.substring(0, 100)}...</span>;
  }

  return String(value);
}

function flexRender<T>(Comp: ((props: T) => React.ReactNode) | string, props: T): React.ReactNode {
  if (typeof Comp === "string") {
    return Comp;
  }
  return <Comp {...props} />;
}
