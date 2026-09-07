import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tremor Button.
 *
 * Follows Tremor's button anatomy: `rounded-tremor-default`, a 1px border that
 * matches the fill, `shadow-tremor-input` elevation and a `font-medium` label.
 * Hover states step the brand ramp up to `brand-emphasis` rather than fading
 * opacity.
 *
 * Variant map against Tremor's own variants:
 * - `default`     → Tremor `primary`
 * - `outline`     → Tremor `secondary` on the neutral ramp (the "white" button)
 * - `secondary`   → neutral filled button (Tremor `gray` surface)
 * - `light`       → Tremor `light` (borderless brand text button)
 * - `ghost`       → Tremor `light` on the neutral ramp
 * - `destructive` → Tremor `primary` with `color="red"`
 */
const buttonVariants = cva(
  "shrink-0 inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium outline-none transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-tremor-brand-muted focus-visible:border-tremor-brand-subtle disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        default:
          "rounded-tremor-default border shadow-tremor-input bg-tremor-brand border-tremor-brand text-tremor-brand-inverted hover:bg-tremor-brand-emphasis hover:border-tremor-brand-emphasis",
        destructive:
          "rounded-tremor-default border shadow-tremor-input bg-red-500 border-red-500 text-white hover:bg-red-600 hover:border-red-600",
        outline:
          "rounded-tremor-default border shadow-tremor-input bg-tremor-background border-tremor-border text-tremor-content-emphasis hover:bg-tremor-background-muted",
        secondary:
          "rounded-tremor-default border shadow-tremor-input bg-tremor-background-subtle border-tremor-border text-tremor-content-emphasis hover:bg-tremor-border",
        light: "bg-transparent text-tremor-brand hover:text-tremor-brand-emphasis",
        ghost:
          "rounded-tremor-default bg-transparent text-tremor-content-emphasis hover:bg-tremor-background-subtle",
        link: "bg-transparent text-tremor-brand underline-offset-4 hover:text-tremor-brand-emphasis hover:underline",
      },
      size: {
        // Tremor proportions: xs / sm / md / lg
        xs: "px-2.5 py-1.5 text-xs",
        sm: "px-3 py-1.5 text-xs",
        default: "px-4 py-2 text-tremor-default",
        lg: "px-4 py-2.5 text-base",
        icon: "h-9 w-9 p-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
