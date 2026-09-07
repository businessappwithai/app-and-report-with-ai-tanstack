"use client";

import { Info } from "lucide-react";
import { STEP_ORDER } from "@/types/project";

interface WizardStepHeaderProps {
  stepNumber: number;
  title: string;
  description: string;
  estimatedTime?: string;
  subtitle?: string;
}

export function WizardStepHeader({
  stepNumber,
  title,
  description,
  estimatedTime = "2-3 min",
  subtitle,
}: WizardStepHeaderProps) {
  return (
    <div className="mb-8 border-b border-border pb-6">
      {/* Step Number & Title */}
      <div className="mb-3">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-semibold text-muted-foreground">
            Step {stepNumber} of {STEP_ORDER.length}
          </span>
          {estimatedTime && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
              ~{estimatedTime}
            </span>
          )}
        </div>
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>

      {/* Description with Info Icon */}
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Info className="w-5 h-5 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
