"use client";

import { AlertCircle, AlertTriangle, CheckCircle } from "lucide-react";
import type { SQLError, SQLValidationResult, SQLWarning } from "@/lib/sql/validator";
import { cn } from "@/lib/utils";

interface ValidationPanelProps {
  validation: SQLValidationResult | null;
  className?: string;
}

export function ValidationPanel({ validation, className }: ValidationPanelProps) {
  if (!validation) {
    return null;
  }

  const hasErrors = validation.errors.length > 0;
  const hasWarnings = validation.warnings.length > 0;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        {validation.isValid ? (
          <div className="flex items-center gap-1 text-emerald-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Valid SQL</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Invalid SQL</span>
          </div>
        )}

        {hasWarnings && (
          <div className="flex items-center gap-1 text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">
              {validation.warnings.length} warning
              {validation.warnings.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Errors */}
      {hasErrors && (
        <div className="space-y-1">
          {validation.errors.map((error) => (
            <ErrorItem
              key={error.message + (error.line ?? "") + (error.column ?? "")}
              error={error}
            />
          ))}
        </div>
      )}

      {/* Warnings */}
      {hasWarnings && (
        <div className="space-y-1">
          {validation.warnings.map((warning) => (
            <WarningItem key={warning.message + (warning.type ?? "")} warning={warning} />
          ))}
        </div>
      )}
    </div>
  );
}

function ErrorItem({ error }: { error: SQLError }) {
  return (
    <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
      <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm text-destructive">{error.message}</p>
        {(error.line || error.column) && (
          <p className="text-xs text-destructive/70 mt-0.5">
            {error.line && `Line ${error.line}`}
            {error.line && error.column && ", "}
            {error.column && `Column ${error.column}`}
          </p>
        )}
      </div>
    </div>
  );
}

function WarningItem({ warning }: { warning: SQLWarning }) {
  const getBadgeColor = (type: string) => {
    switch (type) {
      case "performance":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
      case "security":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "style":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      default:
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    }
  };

  return (
    <div className="flex items-start gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn("text-xs px-1.5 py-0.5 rounded font-medium", getBadgeColor(warning.type))}
          >
            {warning.type}
          </span>
        </div>
        <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">{warning.message}</p>
      </div>
    </div>
  );
}
