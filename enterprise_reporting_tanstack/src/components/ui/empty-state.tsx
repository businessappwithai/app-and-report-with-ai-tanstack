import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tremor empty state.
 *
 * Replaces the bare "No results" strings scattered through the list pages with
 * a consistent block: a muted icon chip, a `content-strong` line saying what is
 * missing, an optional explanation, and the action that fixes it.
 */
export interface EmptyStateProps {
  title: string;
  description?: React.ReactNode;
  icon?: React.ElementType;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon: Icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className
      )}
    >
      {Icon ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-tremor-full bg-tremor-background-subtle">
          <Icon className="h-5 w-5 text-tremor-content-subtle" />
        </div>
      ) : null}
      <div className="space-y-1">
        <p className="font-medium text-tremor-default text-tremor-content-strong">{title}</p>
        {description ? (
          <p className="text-tremor-default text-tremor-content">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
