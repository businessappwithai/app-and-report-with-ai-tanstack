import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tremor Badge.
 *
 * Tremor badges are tinted rather than solid: a 10% colour wash, a 20% inset
 * ring and a 600-shade label, on `rounded-tremor-small`. That keeps dense
 * tables readable where solid pills would fight the data for attention.
 */
const badgeVariants = cva(
  "w-max shrink-0 inline-flex justify-center items-center cursor-default whitespace-nowrap rounded-tremor-small ring-1 ring-inset font-medium",
  {
    variants: {
      variant: {
        default: "bg-tremor-brand-faint text-tremor-brand-emphasis ring-tremor-brand/20",
        secondary: "bg-tremor-background-subtle text-tremor-content-emphasis ring-tremor-border",
        destructive: "bg-red-500/10 text-red-700 dark:text-red-400 ring-red-500/20",
        error: "bg-red-500/10 text-red-700 dark:text-red-400 ring-red-500/20",
        outline: "bg-transparent text-tremor-content-emphasis ring-tremor-border",
        success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20",
        warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20",
        info: "bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-blue-500/20",
        neutral: "bg-gray-500/10 text-gray-700 dark:text-gray-400 ring-gray-500/20",
      },
      size: {
        xs: "px-2 py-0.5 text-xs",
        sm: "px-2.5 py-0.5 text-tremor-label",
        md: "px-3 py-0.5 text-tremor-default",
        lg: "px-3.5 py-0.5 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
