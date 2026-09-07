"use client";

import { Code, Eye, FileText, Rocket, Wand2 } from "lucide-react";
import React from "react";

interface JourneyArcProps {
  currentStep: "init" | "design" | "generate" | "enhance" | "deploy";
}

interface JourneyStep {
  key: "init" | "design" | "generate" | "enhance" | "deploy";
  label: string;
  icon: React.ReactNode;
  description: string;
}

const journeySteps: JourneyStep[] = [
  {
    key: "init",
    label: "Define",
    icon: <FileText className="w-4 h-4" />,
    description: "Your domain",
  },
  {
    key: "design",
    label: "Discover",
    icon: <Eye className="w-4 h-4" />,
    description: "AI extracts entities",
  },
  {
    key: "generate",
    label: "Generate",
    icon: <Code className="w-4 h-4" />,
    description: "Full-stack code",
  },
  {
    key: "enhance",
    label: "Add Features",
    icon: <Wand2 className="w-4 h-4" />,
    description: "Polish & extend",
  },
  {
    key: "deploy",
    label: "Deploy",
    icon: <Rocket className="w-4 h-4" />,
    description: "Go live",
  },
];

export function JourneyArc({ currentStep }: JourneyArcProps) {
  const currentIndex = journeySteps.findIndex((s) => s.key === currentStep);

  return (
    <div className="mb-8 px-4 py-6 bg-card border border-border rounded-lg">
      <p className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wide">
        Your Journey
      </p>
      <div className="flex items-center justify-between gap-2">
        {journeySteps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = step.key === currentStep;

          return (
            <React.Fragment key={step.key}>
              {/* Step Node */}
              <div className="flex flex-col items-center gap-1 flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isCurrent
                      ? "bg-primary text-white ring-2 ring-primary/30"
                      : isCompleted
                        ? "bg-emerald-500/20 text-emerald-500"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step.icon}
                </div>
                <div className="text-center">
                  <div className="text-xs font-semibold text-foreground">{step.label}</div>
                  <div className="text-xs text-muted-foreground">{step.description}</div>
                </div>
              </div>

              {/* Arrow Between Steps */}
              {index < journeySteps.length - 1 && (
                <div className="flex-shrink-0 mb-8">
                  <div
                    className={`w-8 h-1 rounded-full transition-all ${
                      isCompleted ? "bg-emerald-500" : isCurrent ? "bg-primary" : "bg-muted"
                    }`}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
