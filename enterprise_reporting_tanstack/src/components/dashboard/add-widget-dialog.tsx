"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, FileText, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { ChartDefinition, ReportDefinition } from "@/types/database";

interface AddWidgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddWidget: (widget: {
    widgetType: string;
    reportId?: string;
    chartId?: string;
    positionConfig: { x: number; y: number; w: number; h: number; minW: number; minH: number };
    widgetConfig?: { title?: string; content?: string };
  }) => void;
}

export function AddWidgetDialog({ open, onOpenChange, onAddWidget }: AddWidgetDialogProps) {
  const [widgetType, setWidgetType] = useState<"chart" | "report" | "metric" | "text">("chart");
  const [selectedChartId, setSelectedChartId] = useState("");
  const [selectedReportId, setSelectedReportId] = useState("");
  const [widgetTitle, setWidgetTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [width, setWidth] = useState(4);
  const [height, setHeight] = useState(4);

  // Fetch available charts
  const { data: charts = [], isLoading: isLoadingCharts } = useQuery<ChartDefinition[]>({
    queryKey: ["charts"],
    queryFn: async () => {
      const res = await fetch("/api/charts");
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load charts`);
      const data = await res.json();
      return data.data?.items || [];
    },
    enabled: open && widgetType === "chart",
  });

  // Fetch available reports
  const { data: reports = [], isLoading: isLoadingReports } = useQuery<ReportDefinition[]>({
    queryKey: ["reports"],
    queryFn: async () => {
      const res = await fetch("/api/reports");
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load reports`);
      const data = await res.json();
      return data.data?.items || [];
    },
    enabled: open && widgetType === "report",
  });

  const handleAddWidget = () => {
    // Validate based on widget type
    if (widgetType === "chart" && !selectedChartId) {
      toast.error("Please select a chart");
      return;
    }
    if (widgetType === "report" && !selectedReportId) {
      toast.error("Please select a report");
      return;
    }
    if (widgetType === "text" && !textContent) {
      toast.error("Please enter text content");
      return;
    }

    const widgetConfig: { title?: string; content?: string } = {};
    if (widgetTitle) widgetConfig.title = widgetTitle;
    if (widgetType === "text" && textContent) widgetConfig.content = textContent;

    onAddWidget({
      widgetType,
      chartId: widgetType === "chart" ? selectedChartId : undefined,
      reportId: widgetType === "report" ? selectedReportId : undefined,
      positionConfig: {
        x: 0,
        y: 0, // Will be auto-calculated by the grid
        w: width,
        h: height,
        minW: 2,
        minH: 2,
      },
      widgetConfig: Object.keys(widgetConfig).length > 0 ? widgetConfig : undefined,
    });

    // Reset form
    setWidgetType("chart");
    setSelectedChartId("");
    setSelectedReportId("");
    setWidgetTitle("");
    setTextContent("");
    setWidth(4);
    setHeight(4);
    onOpenChange(false);
    toast.success("Widget added successfully");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Widget to Dashboard</DialogTitle>
          <DialogDescription>
            Choose a widget type and configure its content and size
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={widgetType}
          onValueChange={(v) => setWidgetType(v as typeof widgetType)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="chart">
              <BarChart3 className="h-4 w-4 mr-2" />
              Chart
            </TabsTrigger>
            <TabsTrigger value="report">
              <FileText className="h-4 w-4 mr-2" />
              Report
            </TabsTrigger>
            <TabsTrigger value="metric">Metric</TabsTrigger>
            <TabsTrigger value="text">Text</TabsTrigger>
          </TabsList>

          <div className="mt-6 space-y-6">
            {/* Common: Widget Title */}
            <div className="space-y-2">
              <Label htmlFor="widget-title">Widget Title (Optional)</Label>
              <Input
                id="widget-title"
                value={widgetTitle}
                onChange={(e) => setWidgetTitle(e.target.value)}
                placeholder="Custom title for the widget"
              />
            </div>

            {/* Chart Widget */}
            <TabsContent value="chart" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="chart-select">Select Chart *</Label>
                <Select value={selectedChartId} onValueChange={setSelectedChartId}>
                  <SelectTrigger id="chart-select">
                    <SelectValue
                      placeholder={isLoadingCharts ? "Loading charts..." : "Choose a chart"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {charts.map((chart) => (
                      <SelectItem key={chart.id} value={chart.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{chart.name}</span>
                          <span className="text-tremor-label text-tremor-content">
                            {chart.description || "No description"}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* Report Widget */}
            <TabsContent value="report" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="report-select">Select Report *</Label>
                <Select value={selectedReportId} onValueChange={setSelectedReportId}>
                  <SelectTrigger id="report-select">
                    <SelectValue
                      placeholder={isLoadingReports ? "Loading reports..." : "Choose a report"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {reports.map((report) => (
                      <SelectItem key={report.id} value={report.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{report.name}</span>
                          <span className="text-tremor-label text-tremor-content">
                            {report.description || "No description"}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* Metric Widget */}
            <TabsContent value="metric" className="space-y-4">
              <p className="text-tremor-default text-tremor-content">
                Metric widgets display a single key value. Configuration for metrics will be
                available soon.
              </p>
            </TabsContent>

            {/* Text Widget */}
            <TabsContent value="text" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="text-content">Text Content *</Label>
                <Textarea
                  id="text-content"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Enter the text content for this widget..."
                  rows={4}
                />
              </div>
            </TabsContent>

            {/* Size Configuration */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="widget-width">Width (columns)</Label>
                <Select value={String(width)} onValueChange={(v) => setWidth(Number(v))}>
                  <SelectTrigger id="widget-width">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 columns (small)</SelectItem>
                    <SelectItem value="4">4 columns (medium)</SelectItem>
                    <SelectItem value="6">6 columns (large)</SelectItem>
                    <SelectItem value="8">8 columns (x-large)</SelectItem>
                    <SelectItem value="12">12 columns (full width)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="widget-height">Height (rows)</Label>
                <Select value={String(height)} onValueChange={(v) => setHeight(Number(v))}>
                  <SelectTrigger id="widget-height">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 rows (short)</SelectItem>
                    <SelectItem value="4">4 rows (medium)</SelectItem>
                    <SelectItem value="6">6 rows (tall)</SelectItem>
                    <SelectItem value="8">8 rows (x-tall)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddWidget}>
            <Plus className="h-4 w-4 mr-2" />
            Add Widget
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
