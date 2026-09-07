import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tremor Callout, exposed through the existing Alert API.
 *
 * Tremor callouts are a tinted panel with a 4px accent stripe on the leading
 * edge — `rounded-tremor-default`, 10% colour wash, 700-shade text — rather
 * than a fully bordered box.
 */
const alertVariants = cva(
  "relative flex w-full flex-col overflow-hidden rounded-tremor-default border-l-4 py-3 pl-4 pr-3 text-tremor-default [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-3.5 [&>svg]:h-5 [&>svg]:w-5",
  {
    variants: {
      variant: {
        default: "bg-tremor-brand-faint border-tremor-brand-emphasis text-tremor-brand-emphasis",
        info: "bg-blue-500/10 border-blue-700 text-blue-700 dark:text-blue-400",
        success: "bg-emerald-500/10 border-emerald-700 text-emerald-700 dark:text-emerald-400",
        warning: "bg-amber-500/10 border-amber-700 text-amber-700 dark:text-amber-400",
        destructive: "bg-red-500/10 border-red-700 text-red-700 dark:text-red-400",
        neutral: "bg-tremor-background-subtle border-tremor-border text-tremor-content-emphasis",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn("font-semibold leading-none text-inherit", className)} {...props} />
  )
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("mt-2 overflow-y-auto text-inherit [&_p]:leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertDescription, AlertTitle, alertVariants };
