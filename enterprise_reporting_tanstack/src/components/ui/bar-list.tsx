"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tremor BarList.
 *
 * Horizontal ranked bars with the label rendered *inside* the bar and the value
 * right-aligned in a parallel column — Tremor's standard "top N" breakdown.
 * Bars are sized relative to the largest value in the set.
 */
const barColors = {
  brand: "bg-tremor-brand-muted",
  emerald: "bg-emerald-500/30",
  amber: "bg-amber-500/30",
  red: "bg-red-500/30",
  gray: "bg-gray-500/30",
} as const;

export type BarListColor = keyof typeof barColors;

export interface BarListItem {
  name: string;
  value: number;
  /** Optional link — renders the label as an anchor, as Tremor's BarList does. */
  href?: string;
  icon?: React.ElementType;
  color?: BarListColor;
}

export interface BarListProps extends React.HTMLAttributes<HTMLDivElement> {
  data: BarListItem[];
  valueFormatter?: (value: number) => string;
  /** Sort descending by value before rendering (default: true). */
  sortOrder?: "descending" | "ascending" | "none";
  color?: BarListColor;
}

const defaultValueFormatter = (value: number) => value.toLocaleString();

const BarList = React.forwardRef<HTMLDivElement, BarListProps>(
  (
    {
      data,
      valueFormatter = defaultValueFormatter,
      sortOrder = "descending",
      color = "brand",
      className,
      ...props
    },
    ref
  ) => {
    const rows = React.useMemo(() => {
      if (sortOrder === "none") return data;
      const sorted = [...data];
      sorted.sort((a, b) => (sortOrder === "descending" ? b.value - a.value : a.value - b.value));
      return sorted;
    }, [data, sortOrder]);

    const maxValue = React.useMemo(
      () => rows.reduce((max, item) => Math.max(max, item.value), 0),
      [rows]
    );

    return (
      <div ref={ref} className={cn("flex justify-between gap-6", className)} {...props}>
        <div className="relative w-full space-y-1.5">
          {rows.map((item) => {
            const widthPercent = maxValue > 0 ? Math.max((item.value / maxValue) * 100, 2) : 0;
            const Icon = item.icon;
            return (
              <div
                key={item.name}
                className={cn(
                  "flex items-center rounded-tremor-small",
                  barColors[item.color ?? color]
                )}
                style={{ width: `${widthPercent}%` }}
              >
                <div className="absolute left-2 flex max-w-full items-center gap-2 pr-4">
                  {Icon ? <Icon className="h-4 w-4 shrink-0 text-tremor-content-subtle" /> : null}
                  {item.href ? (
                    <a
                      href={item.href}
                      className="truncate whitespace-nowrap text-tremor-default text-tremor-content-emphasis hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.name}
                    </a>
                  ) : (
                    <span className="truncate whitespace-nowrap text-tremor-default text-tremor-content-emphasis">
                      {item.name}
                    </span>
                  )}
                </div>
                <div className="h-8" />
              </div>
            );
          })}
        </div>
        <div className="space-y-1.5 text-right">
          {rows.map((item) => (
            <div
              key={`${item.name}-value`}
              className="flex h-8 items-center justify-end whitespace-nowrap text-tremor-default leading-none text-tremor-content-emphasis"
            >
              {valueFormatter(item.value)}
            </div>
          ))}
        </div>
      </div>
    );
  }
);
BarList.displayName = "BarList";

export { BarList };
