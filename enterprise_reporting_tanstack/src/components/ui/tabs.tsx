"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tremor Tabs.
 *
 * Tremor ships two tab treatments and this component exposes both:
 *
 * - `line` (default) — underlined navigation sitting on a `tremor-border` rule,
 *   the selected tab picking up a 2px brand underline.
 * - `solid` — a segmented control on a `background-subtle` track, the selected
 *   tab lifted onto a white surface with `shadow-tremor-input`.
 *
 * Pass the variant on `TabsList`; triggers pick it up through context.
 */
type TabsVariant = "line" | "solid";

const TabsVariantContext = React.createContext<TabsVariant>("line");

const Tabs = TabsPrimitive.Root;

const listVariants: Record<TabsVariant, string> = {
  line: "flex justify-start overflow-x-clip border-b border-tremor-border space-x-4",
  solid:
    "inline-flex justify-start overflow-x-clip rounded-tremor-default bg-tremor-background-subtle p-0.5 space-x-1.5",
};

const triggerVariants: Record<TabsVariant, string> = {
  line: cn(
    "-mb-px border-b-2 border-transparent px-2 py-2 text-tremor-content transition duration-100",
    "hover:border-tremor-content hover:text-tremor-content-emphasis",
    "data-[state=active]:border-tremor-brand data-[state=active]:text-tremor-brand"
  ),
  solid: cn(
    "rounded-tremor-small border border-transparent px-2.5 py-1 text-tremor-content transition duration-100",
    "hover:text-tremor-content-emphasis",
    "data-[state=active]:border-tremor-border data-[state=active]:bg-tremor-background data-[state=active]:text-tremor-brand data-[state=active]:shadow-tremor-input"
  ),
};

interface TabsListProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  variant?: TabsVariant;
}

const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  ({ className, variant = "line", ...props }, ref) => (
    <TabsVariantContext.Provider value={variant}>
      <TabsPrimitive.List ref={ref} className={cn(listVariants[variant], className)} {...props} />
    </TabsVariantContext.Provider>
  )
);
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(TabsVariantContext);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex max-w-xs items-center gap-2 truncate whitespace-nowrap text-tremor-default font-medium outline-none",
        "focus-visible:ring-2 focus-visible:ring-tremor-brand-muted",
        "disabled:pointer-events-none disabled:opacity-50",
        triggerVariants[variant],
        className
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 outline-none focus-visible:ring-2 focus-visible:ring-tremor-brand-muted",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsContent, TabsList, TabsTrigger };
