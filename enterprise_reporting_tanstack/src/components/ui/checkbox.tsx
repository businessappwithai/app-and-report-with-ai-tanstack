import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      // Tremor Checkbox: neutral border unchecked, brand fill checked
      "peer h-4 w-4 shrink-0 rounded-tremor-small border border-tremor-border bg-tremor-background shadow-tremor-input outline-none transition duration-100",
      "focus-visible:border-tremor-brand-subtle focus-visible:ring-2 focus-visible:ring-tremor-brand-muted",
      "disabled:cursor-not-allowed disabled:bg-tremor-background-subtle disabled:opacity-50",
      "data-[state=checked]:border-tremor-brand data-[state=checked]:bg-tremor-brand data-[state=checked]:text-tremor-brand-inverted",
      "data-[state=indeterminate]:border-tremor-brand data-[state=indeterminate]:bg-tremor-brand data-[state=indeterminate]:text-tremor-brand-inverted",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
