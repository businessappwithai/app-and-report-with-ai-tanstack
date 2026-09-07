import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          // Tremor Textarea: same shell as TextInput, taller default box
          "flex min-h-[80px] w-full rounded-tremor-default border border-tremor-border bg-tremor-background px-3 py-2 text-tremor-default text-tremor-content-emphasis shadow-tremor-input outline-none transition duration-100",
          "placeholder:text-tremor-content",
          "focus:border-tremor-brand-subtle focus:ring-2 focus:ring-tremor-brand-muted",
          "disabled:cursor-not-allowed disabled:bg-tremor-background-subtle disabled:text-tremor-content-subtle",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
