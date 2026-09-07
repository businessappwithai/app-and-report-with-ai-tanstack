"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Check, ChevronsUpDown, X } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// Tremor-tinted chip styles for the selected values
const multiSelectVariants = cva("transition-colors duration-100", {
  variants: {
    variant: {
      default: "bg-tremor-brand-faint text-tremor-brand-emphasis ring-tremor-brand/20",
      secondary: "bg-tremor-background-subtle text-tremor-content-emphasis ring-tremor-border",
      destructive: "bg-red-500/10 text-red-700 dark:text-red-400 ring-red-500/20",
      neutral: "bg-gray-500/10 text-gray-700 dark:text-gray-400 ring-gray-500/20",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface MultiSelectProps extends VariantProps<typeof multiSelectVariants> {
  options: { label: string; value: string }[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  maxCount?: number;
  modalPopover?: boolean;
  className?: string;
}

export const MultiSelect = React.forwardRef<HTMLButtonElement, MultiSelectProps>(
  (
    {
      options,
      value,
      onValueChange,
      placeholder = "Select options",
      maxCount,
      variant,
      modalPopover = false,
      className,
      ...props
    },
    ref
  ) => {
    const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);

    const handleSelectOption = (optionValue: string) => {
      const newSelectedValues = value.includes(optionValue)
        ? value.filter((v) => v !== optionValue)
        : [...value, optionValue];

      if (maxCount && newSelectedValues.length > maxCount) {
        return;
      }

      onValueChange(newSelectedValues);
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onValueChange([]);
    };

    const handleRemove = (optionValue: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newSelectedValues = value.filter((v) => v !== optionValue);
      onValueChange(newSelectedValues);
    };

    return (
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen} modal={modalPopover}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            {...props}
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal h-auto py-2",
              value.length > 0 && "h-auto min-h-[38px]",
              className
            )}
            onClick={() => setIsPopoverOpen(!isPopoverOpen)}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                {value.length === 0 ? (
                  <span className="text-tremor-default text-tremor-content">{placeholder}</span>
                ) : (
                  value.map((v) => {
                    const option = options.find((o) => o.value === v);
                    return (
                      <Badge
                        key={v}
                        className={cn("cursor-pointer", multiSelectVariants({ variant }))}
                        onClick={(e) => handleRemove(v, e)}
                      >
                        {option?.label || v}
                        <X
                          className="ml-1 h-3 w-3 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(v, e as any);
                          }}
                        />
                      </Badge>
                    );
                  })
                )}
              </div>
              <div className="flex items-center gap-1">
                {value.length > 0 && (
                  <X
                    className="h-4 w-4 cursor-pointer text-muted-foreground"
                    onClick={handleClear}
                  />
                )}
                <ChevronsUpDown className="h-4 w-4 opacity-50" />
              </div>
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <ScrollArea className="h-[300px] w-full p-1">
            <div className="space-y-1">
              {options.map((option) => {
                const isSelected = value.includes(option.value);
                return (
                  <div
                    key={option.value}
                    role="option"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") handleSelectOption(option.value);
                    }}
                    aria-selected={isSelected}
                    className="flex items-center gap-2 px-3 py-2 text-tremor-default rounded-tremor-small hover:bg-tremor-background-muted cursor-pointer select-none"
                    onClick={() => handleSelectOption(option.value)}
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-tremor-small border border-tremor-border",
                        isSelected ? "bg-primary text-primary-foreground" : "opacity-50"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <span className="flex-1">{option.label}</span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    );
  }
);

MultiSelect.displayName = "MultiSelect";
