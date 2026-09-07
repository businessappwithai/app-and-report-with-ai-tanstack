import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tremor ProgressBar and ProgressCircle.
 *
 * Both draw the filled portion in the brand colour over a 20%-opacity track,
 * fully rounded (`rounded-tremor-full`), with an optional trailing label.
 */
const progressColors = {
  brand: { track: "bg-tremor-brand-muted/50", bar: "bg-tremor-brand" },
  emerald: { track: "bg-emerald-500/20", bar: "bg-emerald-500" },
  amber: { track: "bg-amber-500/20", bar: "bg-amber-500" },
  red: { track: "bg-red-500/20", bar: "bg-red-500" },
  gray: { track: "bg-gray-500/20", bar: "bg-gray-500" },
} as const;

export type ProgressColor = keyof typeof progressColors;

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Progress in percent (0–100); values outside the range are clamped. */
  value: number;
  label?: string;
  color?: ProgressColor;
  showAnimation?: boolean;
}

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ value, label, color = "brand", showAnimation = true, className, ...props }, ref) => {
    const percent = clampPercent(value);
    const palette = progressColors[color];

    return (
      <div ref={ref} className={cn("flex w-full items-center", className)} {...props}>
        <div
          className={cn("relative flex h-2 w-full items-center rounded-tremor-full", palette.track)}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn(
              "h-full flex-col rounded-tremor-full",
              palette.bar,
              showAnimation && "transition-all duration-300 ease-in-out"
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
        {label ? (
          <div className="ml-2 w-16 truncate text-right text-tremor-default text-tremor-content-emphasis">
            {label}
          </div>
        ) : null}
      </div>
    );
  }
);
ProgressBar.displayName = "ProgressBar";

export interface ProgressCircleProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Progress in percent (0–100); values outside the range are clamped. */
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: ProgressColor;
}

const circleStrokes: Record<ProgressColor, { track: string; bar: string }> = {
  brand: { track: "stroke-tremor-brand-muted/50", bar: "stroke-tremor-brand" },
  emerald: { track: "stroke-emerald-500/20", bar: "stroke-emerald-500" },
  amber: { track: "stroke-amber-500/20", bar: "stroke-amber-500" },
  red: { track: "stroke-red-500/20", bar: "stroke-red-500" },
  gray: { track: "stroke-gray-500/20", bar: "stroke-gray-500" },
};

const ProgressCircle = React.forwardRef<HTMLDivElement, ProgressCircleProps>(
  ({ value, size = 64, strokeWidth = 6, color = "brand", className, children, ...props }, ref) => {
    const percent = clampPercent(value);
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const palette = circleStrokes[color];

    return (
      <div
        ref={ref}
        className={cn("relative inline-flex items-center justify-center", className)}
        {...props}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            strokeWidth={strokeWidth}
            className={palette.track}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (percent / 100) * circumference}
            className={cn(palette.bar, "transition-all duration-300 ease-in-out")}
          />
        </svg>
        {children ? (
          <div className="absolute inset-0 flex items-center justify-center text-tremor-label font-medium text-tremor-content-emphasis">
            {children}
          </div>
        ) : null}
      </div>
    );
  }
);
ProgressCircle.displayName = "ProgressCircle";

export { ProgressBar, ProgressCircle };
