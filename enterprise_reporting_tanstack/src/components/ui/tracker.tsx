"use client";

import * as React from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Tremor Tracker.
 *
 * A row of equal-width blocks, each carrying its own colour and tooltip — the
 * Tremor idiom for uptime, job-run history and SLA timelines. Blocks flex to
 * fill the container, so 30 or 90 buckets both read cleanly.
 */
const trackerColors = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  blue: "bg-blue-500",
  gray: "bg-gray-400 dark:bg-gray-600",
  brand: "bg-tremor-brand",
} as const;

export type TrackerColor = keyof typeof trackerColors;

export interface TrackerBlock {
  key?: string;
  color: TrackerColor;
  tooltip?: string;
}

export interface TrackerProps extends React.HTMLAttributes<HTMLDivElement> {
  data: TrackerBlock[];
}

const Tracker = React.forwardRef<HTMLDivElement, TrackerProps>(
  ({ data, className, ...props }, ref) => (
    <div ref={ref} className={cn("flex h-10 w-full items-center gap-0.5", className)} {...props}>
      {data.map((block, index) => {
        const bar = (
          <div
            className={cn(
              "h-full w-full rounded-tremor-small transition-opacity duration-100 hover:opacity-80",
              trackerColors[block.color]
            )}
          />
        );
        return (
          <div key={block.key ?? `${block.color}-${index}`} className="h-full flex-1">
            {block.tooltip ? (
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <div className="h-full w-full">{bar}</div>
                </TooltipTrigger>
                <TooltipContent>{block.tooltip}</TooltipContent>
              </Tooltip>
            ) : (
              bar
            )}
          </div>
        );
      })}
    </div>
  )
);
Tracker.displayName = "Tracker";

export { Tracker };
