import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tremor Card.
 *
 * A Tremor card is a white (gray-900 in dark mode) surface on the muted app
 * canvas: `ring-1` instead of a border, `rounded-tremor-default`, soft
 * `shadow-tremor-card` elevation and 24px padding.
 *
 * `decoration` adds Tremor's accent stripe on one edge; `decorationColor`
 * accepts any Tailwind border colour class (defaults to the brand colour).
 */
type CardDecoration = "top" | "bottom" | "left" | "right" | "";

const decorationStyles: Record<Exclude<CardDecoration, "">, string> = {
  top: "border-t-4",
  bottom: "border-b-4",
  left: "border-l-4",
  right: "border-r-4",
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  decoration?: CardDecoration;
  /** Tailwind border-colour class, e.g. `border-emerald-500`. */
  decorationColor?: string;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, decoration = "", decorationColor, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative w-full text-left rounded-tremor-default ring-1 bg-tremor-background ring-tremor-ring shadow-tremor-card text-tremor-content-strong",
        decoration ? decorationStyles[decoration] : undefined,
        decoration ? (decorationColor ?? "border-tremor-brand") : undefined,
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1 p-6", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-tremor-title font-medium text-tremor-content-strong", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-tremor-default text-tremor-content", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
