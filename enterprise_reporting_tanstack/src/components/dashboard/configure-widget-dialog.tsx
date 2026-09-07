"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
import type { DashboardWidget } from "@/types/database";

interface ConfigureWidgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widget: (DashboardWidget & { dashboard_id: string }) | null;
}

export function ConfigureWidgetDialog({ open, onOpenChange, widget }: ConfigureWidgetDialogProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");

  // Initialize form when widget changes
  useEffect(() => {
    if (widget && open) {
      try {
        const config = widget.widget_config ? JSON.parse(widget.widget_config) : {};
        setTitle(config.title || "");
      } catch {
        setTitle("");
      }
    } else if (!open) {
      setTitle("");
    }
  }, [widget, open]);

  const updateMutation = useMutation({
    mutationFn: async ({
      dashboardId,
      widgetId,
      updates,
    }: {
      dashboardId: string;
      widgetId: string;
      updates: { widgetConfig?: { title?: string } };
    }) => {
      const res = await fetch(`/api/dashboards/${dashboardId}/widgets/${widgetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "Failed to update widget");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-widgets"] });
      toast.success("Widget updated successfully");
      onOpenChange(false);
      setTitle("");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update widget");
    },
  });

  const handleSave = () => {
    if (!widget) return;

    const widgetConfig: { title?: string } = {};
    if (title) widgetConfig.title = title;

    updateMutation.mutate({
      dashboardId: widget.dashboard_id,
      widgetId: widget.id,
      updates: { widgetConfig: Object.keys(widgetConfig).length > 0 ? widgetConfig : undefined },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure Widget</DialogTitle>
          <DialogDescription>Customize the widget settings</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="widget-title">Widget Title</Label>
            <Input
              id="widget-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Custom widget title"
            />
            <p className="text-tremor-label text-tremor-content">
              Leave empty to use the default title from the chart/report
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
