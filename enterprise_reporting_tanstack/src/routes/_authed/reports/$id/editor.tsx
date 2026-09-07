import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, Plus, Save, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import {
  type FilterGroup,
  ReportFilterBuilder,
} from "@/components/reporting/report-filter-builder";
import { SortableColumnRow } from "@/components/reporting/sortable-column-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type {
  ColumnDefinition,
  FilterDefinition,
  ReportColorTheme,
  ReportDefinition,
  SavedQuery,
} from "@/types/database";

export const Route = createFileRoute("/_authed/reports/$id/editor")({
  component: ReportEditorPage,
});

function ReportEditorPage() {
  const { id: reportId } = Route.useParams();
  const queryClient = useQueryClient();

  const [reportName, setReportName] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [columns, setColumns] = useState<ColumnDefinition[]>([]);
  const [selectedQueryId, setSelectedQueryId] = useState<string>("");
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterGroup>({
    id: "root",
    logic: "AND",
    conditions: [],
  });
  const [exportFormats, setExportFormats] = useState({
    csv: true,
    xlsx: true,
    html: false,
    pdf: false,
  });
  const [filenameTemplate, setFilenameTemplate] = useState({
    field1: null as string | null,
    field2: null as string | null,
  });
  const [colorTheme, setColorTheme] = useState<ReportColorTheme>({
    headerBackgroundColor: "#1e293b",
    headerTextColor: "#ffffff",
    headerFontWeight: "600",
    rowBackgroundColor: "#ffffff",
    rowTextColor: "#334155",
    alternatingRowBackgroundColor: "#f8fafc",
    alternatingRowTextColor: "#334155",
    borderColor: "#e2e8f0",
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedFilterId, setSelectedFilterId] = useState<string>("");
  const [targetColumn, setTargetColumn] = useState<string>("");
  const isLoadingFromServer = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: report, isLoading: isLoadingReport } = useQuery<ReportDefinition>({
    queryKey: ["report", reportId],
    queryFn: async () => {
      const res = await fetch(`/api/reports/${reportId}`);
      const data = await res.json();
      return data.data;
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

  const { data: availableFilters } = useQuery<FilterDefinition[]>({
    queryKey: ["filters"],
    queryFn: async () => {
      const res = await fetch("/api/filters");
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.data ?? []);
    },
  });

  const { data: reportFilters } = useQuery({
    queryKey: ["report-filters", reportId],
    queryFn: async () => {
      const res = await fetch(`/api/reports/${reportId}/filters`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!reportId,
  });

  const { data: queryResult } = useQuery({
    queryKey: ["query-result", selectedQueryId],
    queryFn: async () => {
      if (!selectedQueryId) return null;
      const selectedQuery = queries?.find((q) => q.id === selectedQueryId);
      if (!selectedQuery) return null;
      const res = await fetch("/api/sql/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: selectedQuery.sql_content,
          dataSourceId: selectedQuery.data_source_id,
          limit: 1,
          offset: 0,
        }),
      });
      const data = await res.json();
      if (data.success) return data.data;
      return null;
    },
    enabled: !!selectedQueryId && !!queries,
  });

  useEffect(() => {
    if (queryResult?.columns) {
      const fields = queryResult.columns.map((col: { name: string }) => col.name);
      setAvailableFields(fields);
    } else {
      setAvailableFields([]);
    }
  }, [queryResult]);

  useEffect(() => {
    if (report) {
      isLoadingFromServer.current = true;
      setReportName(report.name);
      setReportDescription(report.description || "");
      setSelectedQueryId(report.saved_query_id || "");
      try {
        setColumns(JSON.parse(report.column_config) || []);
      } catch {
        setColumns([]);
      }
      try {
        setFilters(
          JSON.parse(report.filter_config || '{"id":"root","logic":"AND","conditions":[]}')
        );
      } catch {
        setFilters({ id: "root", logic: "AND", conditions: [] });
      }
      try {
        setExportFormats(
          JSON.parse(report.export_formats || '{"csv":true,"xlsx":true,"html":false,"pdf":true}')
        );
      } catch {
        setExportFormats({ csv: true, xlsx: true, html: false, pdf: true });
      }
      try {
        setFilenameTemplate(
          JSON.parse(report.filename_template || '{"field1":null,"field2":null}')
        );
      } catch {
        setFilenameTemplate({ field1: null, field2: null });
      }
      try {
        const parsedColorTheme = JSON.parse(
          report.color_theme ||
            '{"headerBackgroundColor":"#1e293b","headerTextColor":"#ffffff","headerFontWeight":"600","rowBackgroundColor":"#ffffff","rowTextColor":"#334155","alternatingRowBackgroundColor":"#f8fafc","alternatingRowTextColor":"#334155","borderColor":"#e2e8f0"}'
        );
        setColorTheme(parsedColorTheme);
      } catch {
        setColorTheme({
          headerBackgroundColor: "#1e293b",
          headerTextColor: "#ffffff",
          headerFontWeight: "600",
          rowBackgroundColor: "#ffffff",
          rowTextColor: "#334155",
          alternatingRowBackgroundColor: "#f8fafc",
          alternatingRowTextColor: "#334155",
          borderColor: "#e2e8f0",
        });
      }
      setHasUnsavedChanges(false);
      setTimeout(() => {
        isLoadingFromServer.current = false;
      }, 100);
    }
  }, [report]);

  useEffect(() => {
    if (report && !isLoadingFromServer.current) {
      setHasUnsavedChanges(true);
    }
  }, [report]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: reportName,
          description: reportDescription,
          savedQueryId: selectedQueryId || undefined,
          columnConfig: columns,
          filterConfig: filters,
          exportConfig: exportFormats,
          exportFormats: exportFormats,
          filenameTemplate: filenameTemplate,
          colorTheme: colorTheme,
        }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Report saved successfully");
        queryClient.invalidateQueries({ queryKey: ["report", reportId] });
        setHasUnsavedChanges(false);
      } else {
        toast.error(data.error?.message || "Failed to save report");
      }
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: reportName || "Draft Report",
          description: reportDescription,
          savedQueryId: selectedQueryId || undefined,
          columnConfig: columns,
          filterConfig: filters,
          exportConfig: exportFormats,
          exportFormats: exportFormats,
          filenameTemplate: filenameTemplate,
          colorTheme: colorTheme,
        }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Draft saved");
        queryClient.invalidateQueries({ queryKey: ["report", reportId] });
        window.location.href = `/reports/${reportId}/viewer`;
      } else {
        toast.error(data.error?.message || "Failed to save draft");
      }
    },
  });

  const addFilterMutation = useMutation({
    mutationFn: async ({ filterId, targetColumn }: { filterId: string; targetColumn: string }) => {
      const res = await fetch(`/api/reports/${reportId}/filters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter_id: filterId, target_column: targetColumn }),
      });
      if (!res.ok) throw new Error("Failed to add filter");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Filter added");
      queryClient.invalidateQueries({ queryKey: ["report-filters", reportId] });
    },
  });

  const removeFilterMutation = useMutation({
    mutationFn: async (filterLinkId: string) => {
      const res = await fetch(`/api/reports/${reportId}/filters/${filterLinkId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove filter");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Filter removed");
      queryClient.invalidateQueries({ queryKey: ["report-filters", reportId] });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumns((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleUpdateColumn = (id: string, updates: Partial<ColumnDefinition>) => {
    setColumns((items) => items.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const handleDeleteColumn = (id: string) => {
    setColumns((items) => items.filter((item) => item.id !== id));
  };

  const handleAddColumn = () => {
    const newColumn: ColumnDefinition = {
      id: `col-${Date.now()}`,
      field: "new_field",
      header: "New Column",
      visible: true,
      sortable: true,
      filterable: true,
      resizable: true,
    };
    setColumns([...columns, newColumn]);
  };

  if (isLoadingReport) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-tremor-content">Loading report...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-tremor-content">Report not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Reports", href: "/reports" },
          { label: report.name, href: `/reports/${reportId}/viewer` },
          { label: "Edit" },
        ]}
      />

      <div className="flex items-center justify-between py-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Edit Report</h1>
            {hasUnsavedChanges && (
              <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                Unsaved Changes
              </span>
            )}
          </div>
          <p className="text-tremor-default text-tremor-content">
            Configure report columns and settings
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => saveDraftMutation.mutate()}
            disabled={saveDraftMutation.isPending}
          >
            <Eye className="h-4 w-4 mr-2" />
            {saveDraftMutation.isPending ? "Saving..." : "Preview"}
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="columns">Columns</TabsTrigger>
          <TabsTrigger value="filters">Filters</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-6">Report Settings</h3>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">
                    Name
                  </Label>
                  <Input
                    id="name"
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="query" className="text-sm font-medium">
                    Data Source Query
                  </Label>
                  <Select value={selectedQueryId} onValueChange={setSelectedQueryId}>
                    <SelectTrigger className="h-10">
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
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  rows={4}
                  placeholder="Enter a detailed description for this report..."
                  className="resize-none"
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="columns" className="space-y-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Column Configuration</h3>
            <Button variant="outline" size="sm" onClick={handleAddColumn}>
              <Plus className="h-4 w-4 mr-2" />
              Add Column
            </Button>
          </div>
          <div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Header</TableHead>
                    <TableHead>Field</TableHead>
                    <TableHead>Width</TableHead>
                    <TableHead>Visible</TableHead>
                    <TableHead>Sortable</TableHead>
                    <TableHead>Filterable</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <SortableContext
                    items={columns.map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {columns.map((column) => (
                      <SortableColumnRow
                        key={column.id}
                        column={column}
                        availableFields={availableFields}
                        onUpdate={handleUpdateColumn}
                        onDelete={handleDeleteColumn}
                      />
                    ))}
                  </SortableContext>
                </TableBody>
              </Table>
            </DndContext>
            {columns.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No columns configured. Add columns to define the report structure.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="filters">
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold mb-2">Reusable Query Filters</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Add pre-configured filters that users can select from dropdowns when viewing the
                report.
              </p>
              <div className="space-y-6">
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <Label htmlFor="filter-select">Select Filter</Label>
                    <Select value={selectedFilterId} onValueChange={setSelectedFilterId}>
                      <SelectTrigger id="filter-select">
                        <SelectValue placeholder="Choose a filter..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFilters
                          ?.filter(
                            (f) =>
                              !reportFilters?.some(
                                (rf: { filter_id: string }) => rf.filter_id === f.id
                              )
                          )
                          .map((filter) => (
                            <SelectItem key={filter.id} value={filter.id}>
                              {filter.name}
                              <span className="text-muted-foreground text-xs ml-2">
                                ({filter.display_field} → {filter.value_field})
                              </span>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="target-column">Target Column</Label>
                    <Select value={targetColumn} onValueChange={setTargetColumn}>
                      <SelectTrigger id="target-column">
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFields.map((field) => (
                          <SelectItem key={field} value={field}>
                            {field}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={() => {
                      if (selectedFilterId && targetColumn) {
                        addFilterMutation.mutate({ filterId: selectedFilterId, targetColumn });
                        setSelectedFilterId("");
                        setTargetColumn("");
                      }
                    }}
                    disabled={!selectedFilterId || !targetColumn || addFilterMutation.isPending}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Filter
                  </Button>
                </div>

                {reportFilters && reportFilters.length > 0 && (
                  <div className="space-y-2">
                    <Label>Active Filters</Label>
                    <div className="border rounded-lg divide-y">
                      {reportFilters.map(
                        (rf: { id: string; filter_id: string; target_column: string }) => {
                          const filterDef = availableFilters?.find((f) => f.id === rf.filter_id);
                          if (!filterDef) return null;
                          return (
                            <div key={rf.id} className="flex items-center justify-between p-3">
                              <div className="flex-1">
                                <div className="font-medium">{filterDef.name}</div>
                                <div className="text-tremor-default text-tremor-content">
                                  Filter: <code>{filterDef.display_field}</code> →{" "}
                                  <code>{filterDef.value_field}</code> | Target:{" "}
                                  <code>{rf.target_column}</code>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeFilterMutation.mutate(rf.id)}
                                disabled={removeFilterMutation.isPending}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Static Filter Conditions</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Define static filter conditions for your report.
              </p>
              <div>
                {availableFields.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No fields available. Please select a data source query first.</p>
                  </div>
                ) : (
                  <ReportFilterBuilder
                    filters={filters}
                    availableFields={availableFields}
                    onChange={setFilters}
                  />
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="export">
          <div>
            <h3 className="text-lg font-semibold mb-2">Export Settings</h3>
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="export-csv">CSV Export</Label>
                    <p className="text-tremor-label text-tremor-content">
                      Comma-separated values format
                    </p>
                  </div>
                  <Switch
                    id="export-csv"
                    checked={exportFormats.csv}
                    onCheckedChange={(checked) =>
                      setExportFormats((prev) => ({ ...prev, csv: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="export-xlsx">Excel Export</Label>
                    <p className="text-tremor-label text-tremor-content">Native Excel format</p>
                  </div>
                  <Switch
                    id="export-xlsx"
                    checked={exportFormats.xlsx}
                    onCheckedChange={(checked) =>
                      setExportFormats((prev) => ({ ...prev, xlsx: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="export-html">HTML Export</Label>
                    <p className="text-tremor-label text-tremor-content">
                      Interactive HTML with search and pagination
                    </p>
                  </div>
                  <Switch
                    id="export-html"
                    checked={exportFormats.html}
                    onCheckedChange={(checked) =>
                      setExportFormats((prev) => ({ ...prev, html: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="export-pdf">PDF Export</Label>
                    <p className="text-tremor-label text-tremor-content">
                      Portable Document Format
                    </p>
                  </div>
                  <Switch
                    id="export-pdf"
                    checked={exportFormats.pdf}
                    onCheckedChange={(checked) =>
                      setExportFormats((prev) => ({ ...prev, pdf: checked }))
                    }
                  />
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="text-sm font-semibold mb-4">Filename Template</h4>
                <p className="text-xs text-muted-foreground mb-4">
                  Customize export filenames by selecting fields to concatenate with the report name
                </p>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="field1">First Additional Field (optional)</Label>
                    <Select
                      value={filenameTemplate.field1 || ""}
                      onValueChange={(value) =>
                        setFilenameTemplate((prev) => ({ ...prev, field1: value || null }))
                      }
                    >
                      <SelectTrigger id="field1">
                        <SelectValue placeholder="Select a field..." />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col.id || col.field} value={col.field}>
                            {col.header || col.field}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="field2">Second Additional Field (optional)</Label>
                    <Select
                      value={filenameTemplate.field2 || ""}
                      onValueChange={(value) =>
                        setFilenameTemplate((prev) => ({ ...prev, field2: value || null }))
                      }
                    >
                      <SelectTrigger id="field2">
                        <SelectValue placeholder="Select a field..." />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col.id || col.field} value={col.field}>
                            {col.header || col.field}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-tremor-label text-tremor-content">
                      Example: {reportName || "Report"}
                      {filenameTemplate.field1 ? "[" + filenameTemplate.field1 + "]" : ""}
                      {filenameTemplate.field2 ? "[" + filenameTemplate.field2 + "]" : ""} .pdf
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="text-sm font-semibold mb-4">Color Theme</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {[
                    { key: "headerBackgroundColor", label: "Header Background" },
                    { key: "headerTextColor", label: "Header Text" },
                    { key: "rowBackgroundColor", label: "Row Background" },
                    { key: "rowTextColor", label: "Row Text" },
                    { key: "alternatingRowBackgroundColor", label: "Alternating Row Background" },
                    { key: "alternatingRowTextColor", label: "Alternating Row Text" },
                    { key: "borderColor", label: "Border Color" },
                  ].map(({ key, label }) => (
                    <div key={key} className="space-y-2">
                      <Label>{label}</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={(colorTheme as Record<string, string>)[key] || "#000000"}
                          onChange={(e) => setColorTheme({ ...colorTheme, [key]: e.target.value })}
                          className="h-9 w-16 rounded cursor-pointer"
                        />
                        <span className="text-tremor-label text-tremor-content">
                          {(colorTheme as Record<string, string>)[key]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
