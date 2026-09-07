import { CheckCircle2, Loader2, AlertCircle, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface AgentStep {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "running" | "completed" | "error";
  timestamp?: string;
  details?: Record<string, unknown>;
}

interface AgentStepsDisplayProps {
  steps: AgentStep[];
  isActive: boolean;
  onClear?: () => void;
}

export function AgentStepsDisplay({ steps, isActive, onClear }: AgentStepsDisplayProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  if (!isActive || steps.length === 0) {
    return null;
  }

  const getStepIcon = (status: AgentStep["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "running":
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
    }
  };

  const completedCount = steps.filter((s) => s.status === "completed").length;
  const totalCount = steps.length;
  const progress = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <h3 className="font-semibold text-blue-900 dark:text-blue-100">
              Agent Execution in Progress
            </h3>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            {completedCount} of {totalCount} steps completed
          </p>
        </div>
        {onClear && (
          <button
            onClick={onClear}
            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
          >
            Clear
          </button>
        )}
      </div>

      {/* Steps List */}
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              "rounded-md p-3 transition-colors",
              step.status === "error"
                ? "bg-red-100 dark:bg-red-900/20"
                : step.status === "completed"
                  ? "bg-emerald-100 dark:bg-emerald-900/20"
                  : step.status === "running"
                    ? "bg-blue-100 dark:bg-blue-900/20"
                    : "bg-gray-100 dark:bg-gray-900/20"
            )}
          >
            <button
              onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
              className="w-full flex items-center gap-3 text-left hover:opacity-75 transition-opacity"
            >
              {getStepIcon(step.status)}
              <div className="flex-1">
                <p className="font-medium text-sm">
                  {index + 1}. {step.title}
                </p>
                {step.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {step.description}
                  </p>
                )}
              </div>
              {step.details && (
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    expandedStep === step.id && "rotate-180"
                  )}
                />
              )}
              {step.timestamp && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(step.timestamp).toLocaleTimeString()}
                </span>
              )}
            </button>

            {/* Expanded Details */}
            {expandedStep === step.id && step.details && (
              <div className="mt-3 ml-8 p-3 rounded bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800">
                <pre className="text-xs overflow-auto max-h-48 text-gray-700 dark:text-gray-300">
                  {JSON.stringify(step.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
