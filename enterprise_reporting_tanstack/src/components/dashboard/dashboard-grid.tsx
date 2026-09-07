"use client";

import { useCallback, useState } from "react";
import GridLayout, { type Layout, WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Move, Settings, X } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/widget-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardWidget } from "@/types/database";

const ResponsiveGridLayout = WidthProvider(GridLayout);

interface ActiveFilter {
  sourceWidgetId: string;
  column: string;
  values: unknown[];
  operator: "eq" | "in" | "range";
}

interface DashboardGridProps {
  widgets: (DashboardWidget & {
    title?: string;
  })[];
  layout: Layout[];
  isEditing?: boolean;
  onLayoutChange?: (layout: Layout[]) => void;
  onRemoveWidget?: (widgetId: string) => void;
  onConfigureWidget?: (widgetId: string) => void;
  onFilterApply?: (filter: Omit<ActiveFilter, "id" | "affectedWidgets">) => void;
}

export function DashboardGrid({
  widgets,
  layout,
  isEditing = false,
  onLayoutChange,
  onRemoveWidget,
  onConfigureWidget,
  onFilterApply,
}: DashboardGridProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredWidget, setHoveredWidget] = useState<string | null>(null);

  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      onLayoutChange?.(newLayout);
    },
    [onLayoutChange]
  );

  return (
    <ResponsiveGridLayout
      className="layout"
      layout={layout}
      cols={12}
      rowHeight={100}
      containerPadding={[0, 0]}
      margin={[16, 16]}
      isDraggable={isEditing}
      isResizable
      onLayoutChange={handleLayoutChange}
      onDragStart={() => setIsDragging(true)}
      onDragStop={() => setIsDragging(false)}
      onResizeStart={() => setIsDragging(true)}
      onResizeStop={() => setIsDragging(false)}
      draggableHandle=".drag-handle"
      resizeHandles={isEditing ? ["s", "e", "se", "sw", "n", "ne", "nw", "w"] : ["se"]}
      useCSSTransforms
    >
      {widgets.map((widget) => (
        <section
          key={widget.id}
          className="widget-container relative"
          role="region"
          onMouseEnter={() => setHoveredWidget(widget.id)}
          onMouseLeave={() => setHoveredWidget(null)}
        >
          <Card
            className={cn(
              "h-full overflow-hidden transition-shadow",
              isDragging && "cursor-grabbing shadow-lg",
              isEditing && "ring-2 ring-primary ring-offset-2",
              hoveredWidget === widget.id && !isEditing && "shadow-md"
            )}
          >
            {/* Widget Header with Actions */}
            <CardHeader className="flex flex-row items-center justify-between p-3 pb-2">
              <CardTitle className="text-sm font-medium truncate">
                {widget.title || widget.widget_type}
              </CardTitle>

              {/* Action Buttons - Always visible on hover, visible in edit mode */}
              <div
                className={cn(
                  "flex items-center gap-1 transition-opacity",
                  isEditing || hoveredWidget === widget.id ? "opacity-100" : "opacity-0",
                  "group/widget"
                )}
              >
                {isEditing && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 drag-handle cursor-grab hover:bg-accent"
                    title="Drag to move"
                  >
                    <Move className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-accent"
                  title="Configure widget"
                  onClick={() => onConfigureWidget?.(widget.id)}
                >
                  <Settings className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Delete widget"
                  onClick={() => onRemoveWidget?.(widget.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>

            {/* Widget Content */}
            <CardContent className="p-3 h-[calc(100%-45px)] overflow-hidden">
              <WidgetCard widget={widget} onFilterApply={onFilterApply} />
            </CardContent>
          </Card>

          {/* Resize handle indicator — always visible on hover */}
          <div
            className={cn(
              "absolute bottom-1 right-1 w-3 h-3 border-r-2 border-b-2 border-primary rounded-br-sm pointer-events-none transition-opacity",
              hoveredWidget === widget.id || isEditing ? "opacity-60" : "opacity-0"
            )}
          />
        </section>
      ))}
    </ResponsiveGridLayout>
  );
}
