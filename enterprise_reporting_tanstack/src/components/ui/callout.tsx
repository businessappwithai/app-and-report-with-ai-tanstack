import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tremor Callout.
 *
 * The Tremor idiom for inline explanation and status: a tinted panel with a 4px
 * accent stripe on the leading edge, an optional icon, a semibold title and
 * optional body copy.
 */
const calloutColors = {
  brand: "bg-tremor-brand-faint border-tremor-brand-emphasis text-tremor-brand-emphasis",
  blue: "bg-blue-500/10 border-blue-700 text-blue-700 dark:text-blue-400",
  emerald: "bg-emerald-500/10 border-emerald-700 text-emerald-700 dark:text-emerald-400",
  amber: "bg-amber-500/10 border-amber-700 text-amber-700 dark:text-amber-400",
  red: "bg-red-500/10 border-red-700 text-red-700 dark:text-red-400",
  gray: "bg-tremor-background-subtle border-tremor-border text-tremor-content-emphasis",
} as const;

export type CalloutColor = keyof typeof calloutColors;

export interface CalloutProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  icon?: React.ElementType;
  color?: CalloutColor;
}

const Callout = React.forwardRef<HTMLDivElement, CalloutProps>(
  ({ title, icon: Icon, color = "brand", className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col overflow-hidden rounded-tremor-default border-l-4 py-3 pl-4 pr-3 text-tremor-default",
        calloutColors[color],
        className
      )}
      {...props}
    >
      <div className="flex items-start">
        {Icon ? <Icon className="mr-1.5 h-5 w-5 flex-none" /> : null}
        <h4 className="font-semibold text-inherit">{title}</h4>
      </div>
      {children ? <div className="mt-2 overflow-y-auto">{children}</div> : null}
    </div>
  )
);
Callout.displayName = "Callout";

export { Callout };
