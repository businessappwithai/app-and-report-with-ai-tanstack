import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tremor TextInput.
 *
 * Tremor inputs are `rounded-tremor-default`, carry `shadow-tremor-input`, and
 * focus by stepping the border to `brand-subtle` with a 2px `brand-muted` ring.
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full items-center rounded-tremor-default border border-tremor-border bg-tremor-background px-3 py-2 text-tremor-default text-tremor-content-emphasis shadow-tremor-input outline-none transition duration-100",
          "placeholder:text-tremor-content",
          "file:border-0 file:bg-transparent file:text-tremor-default file:font-medium",
          "focus:border-tremor-brand-subtle focus:ring-2 focus:ring-tremor-brand-muted",
          "disabled:cursor-not-allowed disabled:bg-tremor-background-subtle disabled:text-tremor-content-subtle disabled:placeholder:text-tremor-content-subtle",
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
