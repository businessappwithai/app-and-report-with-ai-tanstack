"use client";

import * as SwitchPrimitives from "@radix-ui/react-switch";
import * as React from "react";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      // Tremor Switch: brand track when on, tremor-border track when off
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-tremor-full border-2 border-transparent outline-none transition-colors duration-100",
      "focus-visible:ring-2 focus-visible:ring-tremor-brand-muted",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-tremor-brand data-[state=unchecked]:bg-tremor-border",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-tremor-full bg-white shadow-tremor-input ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
