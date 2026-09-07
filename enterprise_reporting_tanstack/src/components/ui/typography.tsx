import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tremor text elements.
 *
 * Tremor's type scale is deliberately small — four sizes carry the whole
 * product — and hierarchy comes from colour weight rather than size jumps:
 *
 * | Component  | Size                | Colour            | Use                  |
 * |------------|---------------------|-------------------|----------------------|
 * | `Metric`   | `text-tremor-metric`| content-strong    | KPI values           |
 * | `Title`    | `text-tremor-title` | content-strong    | Card / section titles|
 * | `Subtitle` | `text-tremor-default`| content          | Supporting copy      |
 * | `Text`     | `text-tremor-default`| content          | Body copy            |
 * | `TextLabel`| `text-tremor-label` | content          | Axis / legend labels |
 */

const Metric = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("font-semibold text-tremor-metric text-tremor-content-strong", className)}
      {...props}
    />
  )
);
Metric.displayName = "Metric";

const Title = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("font-medium text-tremor-title text-tremor-content-strong", className)}
      {...props}
    />
  )
);
Title.displayName = "Title";

const Subtitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-tremor-default text-tremor-content", className)} {...props} />
  )
);
Subtitle.displayName = "Subtitle";

const Text = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-tremor-default text-tremor-content", className)} {...props} />
  )
);
Text.displayName = "Text";

const TextLabel = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span ref={ref} className={cn("text-tremor-label text-tremor-content", className)} {...props} />
  )
);
TextLabel.displayName = "TextLabel";

export { Metric, Subtitle, Text, TextLabel, Title };
