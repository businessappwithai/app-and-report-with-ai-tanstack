import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Edit, Eye, FileText, MoreHorizontal, Plus, Trash } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatDateTime } from "@/lib/utils";
import type { ReportDefinition, SavedQuery } from "@/types/database";
import { PageHeader } from "@/components/layout/page-header";

import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";
import { nlBuildPreview, nlSaveReport } from "@/server-fns/admin-builder";
import { nlBuilderListDataSources } from "@/server-fns/admin-builder";

export const Route = createFileRoute("/_authed/reports/")({
  component: ReportsPage,
});

function ReportsContent() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newReportName, setNewReportName] = useState("");
  const [newReportDescription, setNewReportDescription] = useState("");
  const [selectedQueryId, setSelectedQueryId] = useState("");

  const { data: reports, isLoading } = useQuery<ReportDefinition[]>({
    queryKey: ["reports"],
    queryFn: async () => {
      const res = await fetch("/api/reports");
      const data = await res.json();
      return data.data?.items || [];
    },
  });

  const { data: queries } = useQuery<SavedQuery[]>({
    queryKey: ["queries"],
    queryFn: async () => {
      const res = await fetch("/api/queries");
      const data = await res.json();
      return data.data?.items || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newReportName,
          description: newReportDescription,
          savedQueryId: selectedQueryId || undefined,
          columnConfig: [],
        }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Report created successfully");
        queryClient.invalidateQueries({ queryKey: ["reports"] });
        setCreateDialogOpen(false);
        setNewReportName("");
        setNewReportDescription("");
        setSelectedQueryId("");
      } else {
        toast.error(data.error?.message || "Failed to create report");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/reports/${id}`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Report deleted successfully");
        queryClient.invalidateQueries({ queryKey: ["reports"] });
      } else {
        toast.error(data.error?.message || "Failed to delete report");
      }
    },
  });

  // ── CopilotKit data sources ───────────────────────────────────────────────
  const { data: dataSources } = useQuery({
    queryKey: ["data-sources-for-nl"],
    queryFn: () => nlBuilderListDataSources(),
  });

  useCopilotReadable({
    description: "Available data sources the AI can query to build reports",
    value: (dataSources ?? []).map((ds) => ({ id: ds.id, name: ds.name, type: ds.client_type })),
  });
  useCopilotReadable({
    description: "Existing report definitions",
    value: (reports ?? []).map((r) => ({ id: r.id, name: r.name, description: r.description })),
  });

  useCopilotAction({
    name: "createReportFromNL",
    description:
      "Generate SQL from a natural language description, preview it, then save it as a report definition. Use when the user describes a report they want.",
    parameters: [
      {
        name: "reportName",
        type: "string",
        description: "Short title for the report",
        required: true,
      },
      {
        name: "description",
        type: "string",
        description: "What data the report shows",
        required: true,
      },
      {
        name: "dataSourceId",
        type: "string",
        description: "UUID of the data source from available list",
        required: true,
      },
    ],
    handler: async ({ reportName, description, dataSourceId }) => {
      const preview = await nlBuildPreview({ data: { nlDescription: description, dataSourceId } });
      if (!preview.success) return { success: false, error: preview.error };

      await nlSaveReport({
        data: { name: reportName, description, dataSourceId, sql: preview.sql! },
      });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success(`Report "${reportName}" created`);
      return {
        success: true,
        message: `Report "${reportName}" created. Preview shows ${preview.rows?.length ?? 0} rows. Columns: ${preview.columns?.join(", ")}.`,
        sql: preview.sql,
        columns: preview.columns,
        rowCount: preview.rows?.length ?? 0,
      };
    },
  });

  useCopilotAction({
    name: "deleteReport",
    description: "Delete a report definition by ID. Ask the user to confirm first.",
    parameters: [
      { name: "reportId", type: "string", description: "The report ID to delete", required: true },
    ],
    handler: async ({ reportId }) => {
      const res = await fetch(`/api/reports/${reportId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["reports"] });
        toast.success("Report deleted");
        return { success: true };
      }
      return { success: false, error: data.error?.message };
    },
  });
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <CopilotSidebar
      instructions={
        "You are an AI report builder assistant.\nHelp users create and understand reports.\n\nWORKFLOW:\n1. When the user describes a report they want, call createReportFromNL with the description, a data source, and a report name.\n2. Check available data sources from context before calling.\n3. If no data sources exist, tell the user to add one in Data Sources first.\n4. Confirm with the user before saving (ask for a name if not provided).\n\nRULES:\n- Ask for clarification if the description is too vague.\n- Summarise what the generated report will show before saving."
      }
      defaultOpen={false}
      labels={{
        title: "Report Builder AI",
        initial: "Describe the report you need and I'll generate the SQL and create it for you.",
        placeholder: "e.g. Show monthly sales by region for the last quarter…",
      }}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PageHeader title="Reports" description="Create and manage tabular reports" />

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Report
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Report</DialogTitle>
                <DialogDescription>Create a new report from a saved query.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={newReportName}
                    onChange={(e) => setNewReportName(e.target.value)}
                    placeholder="My Report"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={newReportDescription}
                    onChange={(e) => setNewReportDescription(e.target.value)}
                    placeholder="Optional description"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="query">Saved Query</Label>
                  <Select value={selectedQueryId} onValueChange={setSelectedQueryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a query" />
                    </SelectTrigger>
                    <SelectContent>
                      {queries?.map((query) => (
                        <SelectItem key={query.id} value={query.id}>
                          {query.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={!newReportName || createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create Report"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              All Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading reports...</div>
            ) : reports?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No reports created yet. Create your first report to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Query</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Modified</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports?.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {report.name}
                          {(!report.name || report.name === "Draft Report") && (
                            <Badge variant="warning">Draft</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-tremor-content">
                        {report.description || "-"}
                      </TableCell>
                      <TableCell>
                        {report.saved_query_id ? (
                          <Badge variant="secondary">Linked</Badge>
                        ) : (
                          <Badge variant="outline">No Query</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-tremor-content">
                        {formatDateTime(report.created_at)}
                      </TableCell>
                      <TableCell className="text-tremor-content">
                        {formatDateTime(report.updated_at)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to="/reports/$id/viewer" params={{ id: report.id }}>
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to="/reports/$id/editor" params={{ id: report.id }}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteMutation.mutate(report.id)}
                            >
                              <Trash className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </CopilotSidebar>
  );
}

function ReportsPage() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <ReportsContent />
    </CopilotKit>
  );
}
