import { AlertTriangle, CheckCircle, Clock, FileEdit, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DocStatusBadgeProps {
  status?: string | null;
  message?: string | null;
  className?: string;
}

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    className: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  draft: {
    label: "Draft",
    variant: "outline",
    className: "border-amber-300 text-amber-700 bg-amber-50",
    icon: FileEdit,
  },
  pending_rules: {
    label: "Evaluating",
    variant: "outline",
    className: "border-blue-300 text-blue-700 bg-blue-50",
    icon: Clock,
  },
  final: {
    label: "Final",
    variant: "outline",
    className: "border-green-300 text-green-700 bg-green-50",
    icon: CheckCircle,
  },
  approved: {
    label: "Final",
    variant: "outline",
    className: "border-green-300 text-green-700 bg-green-50",
    icon: CheckCircle,
  },
  rejected: {
    label: "Draft",
    variant: "outline",
    className: "border-amber-300 text-amber-700 bg-amber-50",
    icon: FileEdit,
  },
  none: {
    label: "No Rules",
    variant: "secondary",
    className: "text-gray-500",
    icon: CheckCircle,
  },
};

export function DocStatusBadge({ status, message, className = "" }: DocStatusBadgeProps) {
  if (!status || status === "none") return null;

  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const Icon = config.icon;

  let parsedViolations: Array<{ message: string; ruleName?: string }> = [];
  if (message && (status === "rejected" || status === "draft")) {
    try {
      const parsed = JSON.parse(message);
      parsedViolations = (parsed.violations || []).map((v: any) => ({
        message: v.message,
        ruleName: v.ruleName,
      }));
    } catch {
      parsedViolations = [{ message }];
    }
  }

  const badge = (
    <Badge
      variant={config.variant}
      className={`${config.className} ${className} inline-flex items-center gap-1 text-xs`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );

  if (parsedViolations.length > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>{badge}</TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-sm">
            <div className="space-y-1">
              <p className="font-semibold text-xs">Rule Violations:</p>
              {parsedViolations.map((v, i) => (
                <div key={i} className="flex items-start gap-1 text-xs">
                  <AlertTriangle className="h-3 w-3 mt-0.5 text-red-500 flex-shrink-0" />
                  <span>
                    {v.ruleName && <strong>{v.ruleName}: </strong>}
                    {v.message}
                  </span>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}
