/**
 * Entity Browser Component
 *
 * Displays a list of entities with their metadata using TanStack Table.
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
import { Edit, Loader2, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import type { MetadataEntityHeader } from "@/types/database";

interface EntityBrowserProps {
  dataSourceId?: string;
  onEditEntity?: (entityId: string, entity: MetadataEntityHeader) => void;
  onEditFields?: (entityId: string, entityName: string) => void;
  onManagePermissions?: (entityId: string, entityName: string) => void;
}

export function EntityBrowser({
  dataSourceId,
  onEditEntity,
  onEditFields,
  onManagePermissions,
}: EntityBrowserProps) {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | undefined>(undefined);
  const [isHiddenFilter, setIsHiddenFilter] = useState<boolean | undefined>(undefined);

  // Query entities
  const { data, isLoading, isError, error, refetch } = useEntityListQuery({
    data_source_id: dataSourceId,
    search: search || undefined,
    is_active: isActiveFilter,
    is_hidden: isHiddenFilter,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
  });

  const entities = data?.data?.entities || [];
  const total = data?.data?.total || 0;
  const pageCount = Math.ceil(total / pagination.pageSize);

  // Sync mutation
  const syncMutation = useSyncDatasource();

  // Handle sync
  const handleSync = async () => {
    if (!dataSourceId) return;
    await syncMutation.mutateAsync({ dataSourceId });
    refetch();
  };

  // Table columns
  const columns: ColumnDef<MetadataEntityHeader>[] = [
    {
      accessorKey: "entity_name",
      header: "Entity Name",
      cell: ({ row }) => <div className="font-medium">{row.getValue("entity_name")}</div>,
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <div className="max-w-md truncate text-sm text-muted-foreground">
          {row.getValue("description") || <span className="italic">No description</span>}
        </div>
      ),
    },
    {
      accessorKey: "is_active",
      header: "Active",
      cell: ({ row }) => (
        <Badge variant={row.getValue("is_active") ? "default" : "secondary"}>
          {row.getValue("is_active") ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      accessorKey: "is_hidden",
      header: "Hidden",
      cell: ({ row }) => (
        <Badge variant={row.getValue("is_hidden") ? "outline" : "default"}>
          {row.getValue("is_hidden") ? "Hidden" : "Visible"}
        </Badge>
      ),
    },
    {
      accessorKey: "field_count",
      header: "Fields",
      cell: ({ row }) => <span className="text-sm">{row.original.field_count || 0}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {onEditEntity && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEditEntity(row.original.id, row.original)}
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {onEditFields && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEditFields(row.original.id, row.original.entity_name)}
            >
              Fields
            </Button>
          )}
          {onManagePermissions && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onManagePermissions(row.original.id, row.original.entity_name)}
            >
              Permissions
            </Button>
          )}
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: entities,
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
            <CardTitle>Entity Metadata</CardTitle>
            <CardDescription>
              {total} {total === 1 ? "entity" : "entities"} found
            </CardDescription>
          </div>
          {dataSourceId && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sync Schema
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search entities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Active Filter */}
          <Select
            value={isActiveFilter === undefined ? "all" : String(isActiveFilter)}
            onValueChange={(val) => setIsActiveFilter(val === "all" ? undefined : val === "true")}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Active status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>

          {/* Hidden Filter */}
          <Select
            value={isHiddenFilter === undefined ? "all" : String(isHiddenFilter)}
            onValueChange={(val) => setIsHiddenFilter(val === "all" ? undefined : val === "true")}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Visibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="false">Visible</SelectItem>
              <SelectItem value="true">Hidden</SelectItem>
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
            <p className="text-destructive mb-2">Error loading entities</p>
            <p className="text-tremor-default text-tremor-content">{error?.message}</p>
          </div>
        ) : entities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground mb-2">No entities found</p>
            {dataSourceId && (
              <Button variant="outline" size="sm" onClick={handleSync}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Schema
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
                    <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
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
              {Math.min((pagination.pageIndex + 1) * pagination.pageSize, total)} of {total}{" "}
              entities
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

function flexRender<T>(Comp: ((props: T) => React.ReactNode) | string, props: T): React.ReactNode {
  if (typeof Comp === "string") {
    return Comp;
  }
  return <Comp {...props} />;
}
