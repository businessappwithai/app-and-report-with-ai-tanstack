import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tremor page header.
 *
 * Every page opens the same way: a `content-strong` title, an optional
 * `content` description underneath, and actions pinned to the right. Using one
 * component keeps the type scale and the header-to-content rhythm identical
 * across the application instead of each page inventing its own heading size.
 *
 * ```tsx
 * <PageHeader
 *   title="Reports"
 *   description="Create and manage tabular reports"
 *   actions={<Button>New report</Button>}
 * />
 * ```
 */
export interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  /** Buttons, dialogs or filters aligned to the right of the title. */
  actions?: React.ReactNode;
  /** Rendered before the title — typically a Badge. */
  badge?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, badge, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate font-semibold text-2xl text-tremor-content-strong">{title}</h1>
          {badge}
        </div>
        {description ? (
          <p className="mt-1 text-tremor-default text-tremor-content">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
