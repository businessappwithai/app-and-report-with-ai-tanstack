"use client";

import { ChevronDown } from "lucide-react";
import * as React from "react";

interface CollapseProps {
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}

export function Collapse({ children, className = "", defaultOpen = false }: CollapseProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div
      className={`border border-tremor-border rounded-tremor-default overflow-hidden ${className}`}
    >
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setIsOpen(!isOpen);
        }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-tremor-background-muted transition-colors"
      >
        <span className="text-tremor-default font-medium">
          {isOpen ? "Hide" : "Show"} Resources
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </div>
      {isOpen && (
        <div className="p-3 pt-0 border-t border-tremor-border bg-tremor-background-muted">
          {children}
        </div>
      )}
    </div>
  );
}
