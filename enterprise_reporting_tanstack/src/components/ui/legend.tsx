"use client";

import * as React from "react";

import { getTremorChartColor } from "@/lib/theme/tremor-colors";
import { cn } from "@/lib/utils";

/**
 * Tremor chart Legend.
 *
 * A wrapping row of dot + label pairs in `text-tremor-default` on
 * `text-tremor-content`. Series colours default to the Tremor categorical
 * palette in series order, matching what the chart engine draws.
 */
export interface LegendProps extends React.HTMLAttributes<HTMLOListElement> {
  categories: string[];
  /** Explicit colours (hex or CSS colour) per category; defaults to the Tremor palette. */
  colors?: string[];
  onCategoryClick?: (category: string) => void;
  /** Categories rendered at reduced opacity, e.g. series toggled off. */
  inactiveCategories?: string[];
}

const Legend = React.forwardRef<HTMLOListElement, LegendProps>(
  ({ categories, colors, onCategoryClick, inactiveCategories = [], className, ...props }, ref) => (
    <ol
      ref={ref}
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)}
      {...props}
    >
      {categories.map((category, index) => {
        const color = colors?.[index] ?? getTremorChartColor(index);
        const isInactive = inactiveCategories.includes(category);
        const content = (
          <>
            <span
              className="h-2 w-2 shrink-0 rounded-tremor-full"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            <span className="truncate whitespace-nowrap">{category}</span>
          </>
        );

        return (
          <li
            key={category}
            className={cn(
              "flex items-center gap-2 text-tremor-default text-tremor-content",
              isInactive && "opacity-40"
            )}
          >
            {onCategoryClick ? (
              <button
                type="button"
                onClick={() => onCategoryClick(category)}
                className="flex items-center gap-2 rounded-tremor-small outline-none transition-colors hover:text-tremor-content-emphasis focus-visible:ring-2 focus-visible:ring-tremor-brand-muted"
              >
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ol>
  )
);
Legend.displayName = "Legend";

export { Legend };
