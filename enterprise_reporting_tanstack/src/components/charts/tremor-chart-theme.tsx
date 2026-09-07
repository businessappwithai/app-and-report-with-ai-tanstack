"use client";

/**
 * Tremor chart chrome for Recharts.
 *
 * Tremor charts strip the frame down: no axis rules, no tick marks, horizontal
 * grid lines only, 12px grey tick labels, dotted hover cursor, and a card-like
 * tooltip. These helpers apply that treatment to any Recharts chart so
 * Recharts-based and ECharts-based visuals read identically.
 *
 * ```tsx
 * <LineChart data={data}>
 *   <CartesianGrid {...tremorGridProps} />
 *   <XAxis dataKey="date" {...tremorXAxisProps} />
 *   <YAxis {...tremorYAxisProps} />
 *   <Tooltip content={<TremorChartTooltip />} cursor={tremorCursorProps} />
 *   <Line dataKey="revenue" stroke={getTremorChartColor(0)} {...tremorLineProps} />
 * </LineChart>
 * ```
 */

import type { TooltipProps } from "recharts";
import { Legend } from "@/components/ui/legend";
import { getTremorChartColor, getTremorChartPalette } from "@/lib/theme/tremor-colors";
import { cn } from "@/lib/utils";

/** `currentColor`-driven tick styling so axes follow the active colour scheme. */
const tickStyle = {
  fill: "currentColor",
  fontSize: 12, // text-tremor-label
} as const;

/** Horizontal-only grid lines, as Tremor draws them. */
export const tremorGridProps = {
  horizontal: true,
  vertical: false,
  className: "stroke-tremor-border",
  strokeOpacity: 1,
} as const;

export const tremorXAxisProps = {
  axisLine: false,
  tickLine: false,
  tickMargin: 8,
  minTickGap: 8,
  tick: tickStyle,
  className: "text-tremor-content",
} as const;

export const tremorYAxisProps = {
  axisLine: false,
  tickLine: false,
  tickMargin: 8,
  width: 56,
  tick: tickStyle,
  className: "text-tremor-content",
} as const;

/** Tremor's hover cursor: a thin dashed rule in the border colour. */
export const tremorCursorProps = {
  strokeDasharray: "3 3",
  className: "stroke-tremor-border",
} as const;

/** Tremor line/area geometry: 2px stroke, dots only on hover. */
export const tremorLineProps = {
  strokeWidth: 2,
  dot: false,
  activeDot: { r: 4, strokeWidth: 2 },
  type: "linear",
} as const;

/** Tremor bars: 4px top radius, no active highlight fill. */
export const tremorBarProps = {
  radius: [4, 4, 0, 0] as [number, number, number, number],
  activeBar: { fillOpacity: 0.85 },
} as const;

/** Tremor area fill: 20% of the series colour. */
export const tremorAreaProps = {
  strokeWidth: 2,
  fillOpacity: 0.2,
  dot: false,
  activeDot: { r: 4, strokeWidth: 2 },
  type: "linear",
} as const;

const defaultValueFormatter = (value: number | string) =>
  typeof value === "number" ? value.toLocaleString() : String(value);

export interface TremorChartTooltipProps extends TooltipProps<number, string> {
  valueFormatter?: (value: number | string) => string;
  className?: string;
}

/**
 * Tremor chart tooltip — a `rounded-tremor-default` surface with the category
 * label in a tinted header strip and one colour-dotted row per series.
 */
export function TremorChartTooltip({
  active,
  payload,
  label,
  valueFormatter = defaultValueFormatter,
  className,
}: TremorChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className={cn(
        "rounded-tremor-default border border-tremor-border bg-tremor-background text-tremor-default shadow-tremor-dropdown",
        className
      )}
    >
      {label !== undefined && label !== null && label !== "" ? (
        <div className="border-b border-tremor-border px-4 py-2">
          <p className="font-medium text-tremor-content-emphasis">{String(label)}</p>
        </div>
      ) : null}
      <div className="space-y-1 px-4 py-2">
        {payload.map((entry, index) => (
          <div
            key={`${entry.dataKey ?? entry.name ?? index}`}
            className="flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-tremor-full"
                style={{ backgroundColor: entry.color ?? getTremorChartColor(index) }}
                aria-hidden
              />
              <span className="whitespace-nowrap text-tremor-content">
                {entry.name ?? entry.dataKey}
              </span>
            </div>
            <span className="whitespace-nowrap font-medium tabular-nums text-tremor-content-emphasis">
              {valueFormatter(entry.value as number)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface LegendPayloadItem {
  value?: string | number;
  color?: string;
  dataKey?: string | number;
}

/**
 * Tremor chart legend for Recharts. Pass it as an element so Recharts injects
 * the legend payload: `<Legend content={<TremorChartLegend />} />`.
 */
export function TremorChartLegend({
  payload,
  className,
}: {
  payload?: LegendPayloadItem[];
  className?: string;
}) {
  if (!payload?.length) return null;

  return (
    <Legend
      className={cn("mt-3 justify-center", className)}
      categories={payload.map((entry, index) => String(entry.value ?? entry.dataKey ?? index))}
      colors={payload.map((entry, index) => entry.color ?? getTremorChartColor(index))}
    />
  );
}

export { getTremorChartColor, getTremorChartPalette };
