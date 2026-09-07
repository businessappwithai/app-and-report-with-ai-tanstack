"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface TemplateEditorProps {
  templateId?: string;
  onSave: (template: {
    name: string;
    subject: string;
    htmlBody: string;
    queryId?: string;
    columnMappings: Record<string, string>;
  }) => void;
  onCancel: () => void;
}

interface Query {
  id: string;
  name: string;
  sql_content: string;
  data_source_id: string;
}

interface PreviewData {
  rowIndex: number;
  data: Record<string, unknown>;
  preview: string;
  subjectPreview: string;
}

export function TemplateEditor({ templateId, onSave, onCancel }: TemplateEditorProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("content");

  // Form state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [selectedQueryId, setSelectedQueryId] = useState<string>("");
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});

  // Fetch existing template if editing
  const { data: existingTemplate, isLoading: isLoadingTemplate } = useQuery({
    queryKey: ["email-template", templateId],
    queryFn: async () => {
      if (!templateId) return null;
      const res = await fetch(`/api/email-templates/${templateId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load template`);
      const data = await res.json();
      if (data.success) {
        return data.data;
      }
      return null;
    },
    enabled: !!templateId,
  });

  // Populate form when template loads
  useEffect(() => {
    if (existingTemplate) {
      setName(existingTemplate.name || "");
      setSubject(existingTemplate.subject || "");
      setHtmlBody(existingTemplate.htmlBody || "");
      setSelectedQueryId(existingTemplate.queryId || "");
      setColumnMappings(existingTemplate.columnMappings || {});
    }
  }, [existingTemplate]);

  // Fetch queries
  const { data: queries = [] } = useQuery<Query[]>({
    queryKey: ["queries"],
    queryFn: async () => {
      const res = await fetch("/api/queries");
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load queries`);
      const data = await res.json();
      return data.data?.items || [];
    },
  });

  // Fetch query results for selected query
  const { data: queryResults = [] } = useQuery({
    queryKey: ["query-results", selectedQueryId],
    queryFn: async () => {
      if (!selectedQueryId) return [];
      const res = await fetch(`/api/queries/${selectedQueryId}/execute`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to execute query`);
      const data = await res.json();
      return data.data?.rows?.slice(0, 5) || [];
    },
    enabled: !!selectedQueryId && activeTab === "mappings",
  });

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!templateId) {
        throw new Error("Template must be saved first");
      }
      const res = await fetch(`/api/email-templates/${templateId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview" }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setActiveTab("preview");
      }
    },
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const url = templateId ? `/api/email-templates/${templateId}` : "/api/email-templates";
      const method = templateId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subject,
          htmlBody,
          queryId: selectedQueryId || null,
          columnMappings,
        }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(templateId ? "Template updated" : "Template created");
        queryClient.invalidateQueries({ queryKey: ["email-templates"] });
        queryClient.invalidateQueries({ queryKey: ["email-template", templateId] });
        onSave(data.data);
      } else {
        toast.error(data.error?.message || "Failed to save template");
      }
    },
  });

  // Get available columns from query results
  const availableColumns = queryResults.length > 0 ? Object.keys(queryResults[0]) : [];

  // Extract placeholders from template
  const placeholders = htmlBody.match(/{{(\w+)}}/g)?.map((p) => p.replace(/{{|}}/g)) || [];
  const uniquePlaceholders = Array.from(new Set(placeholders));

  const handleSave = () => {
    if (!name || !subject || !htmlBody) {
      toast.error("Name, subject, and HTML body are required");
      return;
    }
    saveMutation.mutate();
  };

  const insertPlaceholder = (placeholder: string) => {
    setHtmlBody((prev) => `${prev}{{${placeholder}}}`);
  };

  if (isLoadingTemplate) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="placeholders">Placeholders</TabsTrigger>
          <TabsTrigger value="mappings">Query & Mappings</TabsTrigger>
          <TabsTrigger value="preview" disabled={!templateId}>
            Preview
          </TabsTrigger>
        </TabsList>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Template Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Billing Report Template"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Email Subject *</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Your bill for {{month}} is ready"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="htmlBody">HTML Body *</Label>
            <Textarea
              id="htmlBody"
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
              placeholder="<!DOCTYPE html>..."
              rows={15}
              className="font-mono text-sm"
            />
            <p className="text-tremor-label text-tremor-content">
              Use {"{{placeholder}}"} syntax for variables. Available: {"{{#if var}}...{{/if}}"} for
              conditionals
            </p>
          </div>
        </TabsContent>

        {/* Placeholders Tab */}
        <TabsContent value="placeholders" className="space-y-4 mt-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Quick Insert Placeholders</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Click to insert placeholders into your template
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                "customer_name",
                "email",
                "invoice_number",
                "amount",
                "due_date",
                "month",
                "year",
                "company_name",
                "queryResults",
                "_rowNumber",
                "_totalRows",
              ].map((placeholder) => (
                <Button
                  key={placeholder}
                  variant="outline"
                  size="sm"
                  onClick={() => insertPlaceholder(placeholder)}
                  className="font-mono text-xs"
                >
                  {`{{${placeholder}}}`}
                </Button>
              ))}
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h4 className="text-sm font-medium mb-2">Conditional Blocks</h4>
            <p className="text-xs text-muted-foreground mb-2">
              Use conditional blocks to show/hide content:
            </p>
            <code className="text-xs bg-background p-2 rounded block">
              {"{{#if amount}}"}
              <br />
              {"  Total: {{amount}}"}
              <br />
              {"{{/if}}"}
            </code>
          </div>
        </TabsContent>

        {/* Query & Mappings Tab */}
        <TabsContent value="mappings" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="query">Connect Query (Optional)</Label>
            <Select value={selectedQueryId} onValueChange={setSelectedQueryId}>
              <SelectTrigger id="query">
                <SelectValue placeholder="Select a saved query" />
              </SelectTrigger>
              <SelectContent>
                {queries.map((query) => (
                  <SelectItem key={query.id} value={query.id}>
                    {query.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-tremor-label text-tremor-content">
              Connect a query to fetch data for placeholders (e.g., customer data for billing
              emails)
            </p>
          </div>

          {selectedQueryId && availableColumns.length > 0 && (
            <div className="space-y-3">
              <Label>Column Mappings</Label>
              <p className="text-tremor-label text-tremor-content">
                Map query columns to template placeholders
              </p>

              <div className="space-y-2">
                {uniquePlaceholders.map((placeholder) => (
                  <div key={placeholder} className="flex items-center gap-2">
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded min-w-[120px]">
                      {`{{${placeholder}}}`}
                    </span>
                    <span className="text-tremor-content">→</span>
                    <Select
                      value={columnMappings[placeholder] || ""}
                      onValueChange={(value) => {
                        setColumnMappings((prev) => ({
                          ...prev,
                          [placeholder]: value,
                        }));
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableColumns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedQueryId && queryResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Sample Data</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        {availableColumns.map((col) => (
                          <th key={col} className="text-left p-2 font-medium">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryResults.slice(0, 3).map((row) => (
                        <tr key={JSON.stringify(Object.values(row))} className="border-b">
                          {availableColumns.map((col) => (
                            <td key={col} className="p-2">
                              {String(row[col] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Email Preview</h3>
              <p className="text-tremor-label text-tremor-content">
                See how your template looks with actual data
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => previewMutation.mutate()}
              disabled={previewMutation.isPending}
            >
              {previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Refresh Preview
            </Button>
          </div>

          {previewMutation.data?.success ? (
            <div className="space-y-4">
              <div className="text-tremor-default text-tremor-content">
                Showing {previewMutation.data.data.previewingFirst} of{" "}
                {previewMutation.data.data.totalRows} rows
              </div>

              {previewMutation.data.data.previews.map((preview: PreviewData) => (
                <Card key={preview.rowIndex}>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>Row {preview.rowIndex + 1}</span>
                      <Badge variant="secondary">{preview.subjectPreview}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="border rounded-lg p-4 bg-white"
                      // biome-ignore lint/security/noDangerouslySetInnerHtml: email preview rendering
                      dangerouslySetInnerHTML={{ __html: preview.preview }}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Click "Refresh Preview" to see your template with data
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {templateId ? "Update Template" : "Create Template"}
        </Button>
      </div>
    </div>
  );
}
