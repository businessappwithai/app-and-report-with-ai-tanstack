import { Suspense } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { LayoutGrid, ChevronLeft } from 'lucide-react';
import { UnifiedFieldLayout } from '@/components/admin/unified-field-layout';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { apiClient, type PaginatedResponse } from '@/lib/api-client';
import { useState, useEffect } from 'react';

export const Route = createFileRoute('/admin/fields')({
  validateSearch: (search: Record<string, unknown>) => ({
    entity: (search.entity as string) || undefined,
  }),
  component: FieldLayoutPage,
});

interface SysTable {
  sys_table_id: string;
  table_name: string;
  name: string;
}

function FieldLayoutPageContent() {
  const search = Route.useSearch();
  const [selectedTable, setSelectedTable] = useState<string>(search.entity ?? '');

  const { data: tablesResponse, isLoading: tablesLoading } = useQuery({
    queryKey: ['admin', 'sys-tables'],
    queryFn: () => apiClient.get<PaginatedResponse<SysTable>>('/sys/tables', { limit: 200 }),
  });

  const sysTables: SysTable[] = (tablesResponse as any)?.data ?? [];

  useEffect(() => {
    if (search.entity) setSelectedTable(search.entity);
  }, [search.entity]);

  const selectedTableMeta = sysTables.find((t) => t.table_name === selectedTable);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link to="/admin" className="flex items-center gap-1 hover:text-primary transition-colors">
              <ChevronLeft className="h-3.5 w-3.5" />
              Admin
            </Link>
            <span>/</span>
            <span>Field Layout Manager</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <LayoutGrid className="h-6 w-6 text-primary" />
            Field Layout Manager
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Organize fields into groups, set multi-column layouts, and control visibility — all in one place.
          </p>
        </div>
      </div>

      {/* Entity selector */}
      <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/20">
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Select Entity:</span>
        <Select
          value={selectedTable}
          onValueChange={(value) => setSelectedTable(value)}
        >
          <SelectTrigger className="w-[320px]">
            <SelectValue placeholder="Choose an entity to configure…" />
          </SelectTrigger>
          <SelectContent>
            {tablesLoading ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading…</div>
            ) : (
              sysTables.map((table) => (
                <SelectItem key={table.sys_table_id} value={table.table_name}>
                  {table.name} ({table.table_name})
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {selectedTableMeta && (
          <Badge variant="secondary" className="whitespace-nowrap">
            {selectedTableMeta.name}
          </Badge>
        )}
      </div>

      {/* Unified layout editor */}
      {selectedTable ? (
        <UnifiedFieldLayout entityName={selectedTable} />
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <LayoutGrid className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium">Select an entity above to begin</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            You can then drag fields between groups, set column counts, and control visibility.
          </p>
        </div>
      )}
    </div>
  );
}

function FieldLayoutPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-8">Loading…</div>}>
      <FieldLayoutPageContent />
    </Suspense>
  );
}
