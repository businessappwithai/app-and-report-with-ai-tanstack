import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tremor Divider.
 *
 * A full-width rule with generous vertical rhythm (`my-6`); when given children
 * the label is centred between two rules. Use it to separate blocks *inside* a
 * card — `Separator` remains the right choice for tight, incidental rules.
 */
const Divider = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "mx-auto my-6 flex w-full items-center justify-between gap-3 text-tremor-default text-tremor-content",
        className
      )}
      {...props}
    >
      {children ? (
        <>
          <div className="h-[1px] w-full bg-tremor-border" />
          <div className="whitespace-nowrap text-inherit">{children}</div>
          <div className="h-[1px] w-full bg-tremor-border" />
        </>
      ) : (
        <div className="h-[1px] w-full bg-tremor-border" />
      )}
    </div>
  )
);
Divider.displayName = "Divider";

export { Divider };
