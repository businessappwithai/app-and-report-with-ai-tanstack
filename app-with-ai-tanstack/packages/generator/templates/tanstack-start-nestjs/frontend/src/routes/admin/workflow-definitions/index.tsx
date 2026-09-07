import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { WindowHelpDialog } from "../../../components/admin/window-help-dialog";
import { apiClient } from "../../../lib/api-client";

export const Route = createFileRoute("/admin/workflow-definitions/")({
  component: WorkflowDefinitionsList,
});

interface WfDef {
  id: string;
  name: string;
  entity_name: string;
  operation: string;
  trigger_type?: string;
  source?: string;
  is_active: boolean;
  description?: string;
  created_at: string;
}

function WorkflowDefinitionsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filterEntity, setFilterEntity] = useState("");

  const { data: defs = [], isLoading } = useQuery<WfDef[]>({
    queryKey: ["workflow-definitions"],
    queryFn: () => apiClient.get<any>("/workflow-definitions").then((r: any) => Array.isArray(r) ? r : (r?.items ?? r?.data ?? [])),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/workflow-definitions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflow-definitions"] }),
  });

  const filtered = filterEntity
    ? defs.filter((d) => d.entity_name.toLowerCase().includes(filterEntity.toLowerCase()))
    : defs;

  const stats = {
    total: defs.length,
    active: defs.filter((d) => d.is_active).length,
    entities: Array.from(new Set(defs.map((d) => d.entity_name))).length,
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="flex items-center gap-1 text-sm text-gray-500">
        <Link to="/dashboard" className="hover:text-gray-700 hover:underline">
          Dashboard
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-900 font-medium">Workflow Designer</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
            <WindowHelpDialog windowName="Workflow Designer" entityLabel="Workflow Designer" />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Everything that runs automatically on your records. Built in the automation builder.
          </p>
        </div>
        <Button onClick={() => navigate({ to: "/admin/automations" })}>+ New Workflow</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-gray-500">Total workflows</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <div className="text-xs text-gray-500">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.entities}</div>
            <div className="text-xs text-gray-500">Entities covered</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <input
          className="border rounded px-3 py-1.5 text-sm w-64"
          placeholder="Filter by entity..."
          value={filterEntity}
          onChange={(e) => setFilterEntity(e.target.value)}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No workflows yet.{" "}
          <Link to="/admin/automations" className="text-teal-600 underline">
            Create one
          </Link>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Entity</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Operation</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Runs when</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      <Link
                        to="/admin/workflow-definitions/$id/edit"
                        params={{ id: d.id }}
                        className="text-teal-700 hover:underline"
                      >
                        {d.name}
                      </Link>
                      {d.source === "model" && (
                        <Badge
                          variant="outline"
                          className="ml-2 text-[10px] border-indigo-200 text-indigo-700"
                          title="Declared by a %%workflow section in the model. Edit the model and regenerate."
                        >
                          From the model
                        </Badge>
                      )}
                      {d.description && (
                        <div className="text-xs text-gray-400 mt-0.5">{d.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{d.entity_name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">
                        {d.operation}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">
                        {d.trigger_type === "rule" ? "When a rule triggers it" : "Every write"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          d.is_active
                            ? "bg-green-100 text-green-700 border-green-200"
                            : "bg-gray-100 text-gray-500"
                        }
                      >
                        {d.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(d.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        {/* Opens this row. It used to send every workflow to
                            the builder's own rail at /admin/automations, which
                            lists nothing a model declared — so View on a model
                            workflow landed on a page reading "None yet", and
                            the detail screen that does show the trigger, the
                            rule gates and each step was reachable only by
                            typing its URL. */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            navigate({
                              to: "/admin/workflow-definitions/$id/edit",
                              params: { id: d.id },
                            })
                          }
                        >
                          {d.source === "model" ? "View" : "Edit"}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                              disabled={d.source === "model"}
                              title={
                                d.source === "model"
                                  ? "Declared in the model — remove the %%workflow section and regenerate"
                                  : undefined
                              }
                            >
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete workflow?</AlertDialogTitle>
                              <AlertDialogDescription>
                                "{d.name}" will be permanently removed.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => deleteMutation.mutate(d.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
