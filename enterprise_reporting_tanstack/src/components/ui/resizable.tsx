"use client";

import { GripVertical } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { cn } from "@/lib/utils";

const ResizablePanelGroup = Group;

const ResizablePanel = Panel;

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean;
}) => (
  <Separator
    className={cn(
      "relative flex w-px items-center justify-center bg-tremor-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tremor-brand-muted transition-colors hover:bg-primary/20 hover:after:bg-primary/40 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:flex-col data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 data-[panel-group-direction=vertical]:hover:bg-primary/20 [&[data-panel-group-direction=vertical]>div]:rotate-90 z-50",
      className
    )}
    style={{ zIndex: 50 }}
    {...props}
  >
    {withHandle && (
      <div
        className="z-50 flex h-6 w-4 items-center justify-center rounded-tremor-small border border-tremor-border bg-tremor-background shadow-tremor-input hover:bg-tremor-background-muted hover:border-tremor-brand-subtle transition-all cursor-col-resize"
        style={{ zIndex: 50 }}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </div>
    )}
  </Separator>
);

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
