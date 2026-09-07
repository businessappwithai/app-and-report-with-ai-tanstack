import { ArrowDown, ArrowRight, ArrowUp, MoveDownRight, MoveUpRight } from "lucide-react";
import * as React from "react";

import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Metric, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

/**
 * Tremor BadgeDelta and KpiCard.
 *
 * Tremor's KPI pattern is a card containing a muted label, a `text-tremor-metric`
 * value and a delta badge whose colour and arrow encode direction:
 * increase → emerald, decrease → red, unchanged → gray, with the "moderate"
 * variants using diagonal arrows.
 */
export type DeltaType =
  | "increase"
  | "moderateIncrease"
  | "decrease"
  | "moderateDecrease"
  | "unchanged";

const deltaStyles: Record<DeltaType, { className: string; Icon: React.ElementType }> = {
  increase: {
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20",
    Icon: ArrowUp,
  },
  moderateIncrease: {
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20",
    Icon: MoveUpRight,
  },
  decrease: {
    className: "bg-red-500/10 text-red-700 dark:text-red-400 ring-red-500/20",
    Icon: ArrowDown,
  },
  moderateDecrease: {
    className: "bg-red-500/10 text-red-700 dark:text-red-400 ring-red-500/20",
    Icon: MoveDownRight,
  },
  unchanged: {
    className: "bg-gray-500/10 text-gray-700 dark:text-gray-400 ring-gray-500/20",
    Icon: ArrowRight,
  },
};

export interface BadgeDeltaProps extends React.HTMLAttributes<HTMLSpanElement> {
  deltaType?: DeltaType;
  /** Hide the direction arrow and show the label only. */
  hideIcon?: boolean;
}

const BadgeDelta = React.forwardRef<HTMLSpanElement, BadgeDeltaProps>(
  ({ deltaType = "unchanged", hideIcon = false, className, children, ...props }, ref) => {
    const { className: deltaClassName, Icon } = deltaStyles[deltaType];
    return (
      <span
        ref={ref}
        className={cn(
          "w-max shrink-0 inline-flex items-center justify-center gap-1 rounded-tremor-small px-2 py-0.5 text-tremor-label font-medium ring-1 ring-inset",
          deltaClassName,
          className
        )}
        {...props}
      >
        {hideIcon ? null : <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
        {children ? <span className="whitespace-nowrap">{children}</span> : null}
      </span>
    );
  }
);
BadgeDelta.displayName = "BadgeDelta";

/**
 * Derive a Tremor delta type from a numeric change, using ±5% as the boundary
 * between a moderate and a pronounced move.
 */
export function toDeltaType(change: number, moderateThreshold = 5): DeltaType {
  if (change === 0 || Number.isNaN(change)) return "unchanged";
  if (change > 0) return change >= moderateThreshold ? "increase" : "moderateIncrease";
  return change <= -moderateThreshold ? "decrease" : "moderateDecrease";
}

export interface KpiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  /** Secondary line under the value, e.g. "vs. last month". */
  description?: React.ReactNode;
  delta?: string;
  deltaType?: DeltaType;
  /** Renders a Tremor progress bar under the value (percent, 0–100). */
  progress?: number;
  icon?: React.ElementType;
}

const KpiCard = React.forwardRef<HTMLDivElement, KpiCardProps>(
  (
    {
      label,
      value,
      description,
      delta,
      deltaType,
      progress,
      icon: Icon,
      className,
      children,
      ...props
    },
    ref
  ) => (
    <Card ref={ref} className={cn("p-6", className)} {...props}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="h-5 w-5 shrink-0 text-tremor-content-subtle" /> : null}
          <Text className="truncate">{label}</Text>
        </div>
        {delta ? <BadgeDelta deltaType={deltaType}>{delta}</BadgeDelta> : null}
      </div>
      <Metric className="mt-2">{value}</Metric>
      {description ? <Text className="mt-1">{description}</Text> : null}
      {typeof progress === "number" ? <ProgressBar value={progress} className="mt-4" /> : null}
      {children}
    </Card>
  )
);
KpiCard.displayName = "KpiCard";

export { BadgeDelta, KpiCard };
