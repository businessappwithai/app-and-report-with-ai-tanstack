import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DataSource, SavedQuery } from "@/types/database";
import { PageHeader } from "@/components/layout/page-header";

export const Route = createFileRoute("/_authed/queries/")({
  component: QueriesPage,
});

function QueriesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const {
    data: queriesData,
    isLoading,
    refetch,
  } = useQuery<{
    items: SavedQuery[];
    meta: { total: number };
  }>({
    queryKey: ["saved-queries", "all"],
    queryFn: async () => {
      const res = await fetch("/api/queries?pageSize=100");
      const data = await res.json();
      return data.data;
    },
  });

  const { data: dataSources } = useQuery<DataSource[]>({
    queryKey: ["data-sources"],
    queryFn: async () => {
      const res = await fetch("/api/data-sources");
      const data = await res.json();
      return data.data?.items || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (queryId: string) => {
      await fetch(`/api/queries/${queryId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-queries"] });
      setShowDeleteConfirm(null);
    },
  });

  const queries = queriesData?.items || [];
  const filteredQueries = queries.filter((query) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      query.name.toLowerCase().includes(searchLower) ||
      (query.description?.toLowerCase().includes(searchLower) ?? false) ||
      (dataSources
        ?.find((ds) => ds.id === query.data_source_id)
        ?.name.toLowerCase()
        .includes(searchLower) ??
        false)
    );
  });

  const handleEdit = (query: SavedQuery) => {
    navigate({ to: "/sql-editor", search: { queryId: query.id } });
  };

  const getDataSourceName = (dataSourceId: string) => {
    return dataSources?.find((ds) => ds.id === dataSourceId)?.name || "Unknown";
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <PageHeader title="Saved Queries" description="Manage your saved SQL queries" />
        <Button
          onClick={() => navigate({ to: "/sql-editor" })}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Query
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name, description, or data source..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
        {searchTerm && (
          <Badge variant="secondary" className="text-sm">
            {filteredQueries.length} of {queries.length} queries
          </Badge>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[20%]">Name</TableHead>
              <TableHead className="w-[25%]">Description</TableHead>
              <TableHead className="w-[15%]">Data Source</TableHead>
              <TableHead className="w-[15%]">Created</TableHead>
              <TableHead className="w-[15%]">Modified</TableHead>
              <TableHead className="w-[10%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mr-2"></div>
                    Loading queries...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredQueries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  {searchTerm ? (
                    <div>
                      <p className="text-tremor-content">No queries match your search.</p>
                      <Button variant="link" onClick={() => setSearchTerm("")} className="mt-2">
                        Clear search
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-muted-foreground mb-2">No saved queries found.</p>
                      <Button onClick={() => navigate({ to: "/sql-editor" })}>
                        Create your first query
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredQueries.map((query) => (
                <TableRow key={query.id}>
                  <TableCell className="font-medium">{query.name}</TableCell>
                  <TableCell className="text-tremor-content">
                    {query.description || <span className="italic">No description</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getDataSourceName(query.data_source_id)}</Badge>
                  </TableCell>
                  <TableCell className="text-tremor-default text-tremor-content">
                    {new Date(query.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-tremor-default text-tremor-content">
                    {new Date(query.updated_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        onClick={() => handleEdit(query)}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Edit query"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => setShowDeleteConfirm(query.id)}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        title="Delete query"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center"
          style={{ zIndex: 99999 }}
        >
          <div className="bg-background rounded-lg p-6 max-w-md w-full mx-4 shadow-lg">
            <h2 className="text-xl font-bold mb-4">Confirm Delete</h2>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete this query? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowDeleteConfirm(null)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => deleteMutation.mutate(showDeleteConfirm)}
                variant="destructive"
                className="flex-1"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
