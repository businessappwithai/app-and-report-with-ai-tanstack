import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Zap as Bolt, Code, GitBranch, Settings, Zap } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { JourneyArc } from "@/components/JourneyArc";
import { ProgressStepper } from "@/components/ProgressStepper";
import { WizardStepHeader } from "@/components/WizardStepHeader";
import { erdVersionsApi } from "@/lib/api/projects";
import { requestContext } from "@/lib/request-context";
import { useProjectStore } from "@/store/projectStore";

async function checkAuthMe() {
  const { baseUrl, fetchInit } = await requestContext();
  const res = await fetch(`${baseUrl}/api/auth/me`, fetchInit);
  return res.json() as Promise<{ user: { id: string; email: string; role: string } | null }>;
}

export const Route = createFileRoute("/projects/$id/enhance/")({
  beforeLoad: async () => {
    try {
      const data = await checkAuthMe();
      if (!data.user) throw redirect({ to: "/login" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
      throw redirect({ to: "/login" });
    }
  },
  component: EnhancePage,
});

interface ServiceInfo {
  name: string;
  entity: string;
  description: string;
  icon: React.ReactNode;
  hooksCount: number;
}

const ICON_CYCLE = [
  (key: number) => <Settings key={key} className="w-6 h-6" />,
  (key: number) => <Code key={key} className="w-6 h-6" />,
  (key: number) => <GitBranch key={key} className="w-6 h-6" />,
  (key: number) => <Bolt key={key} className="w-6 h-6" />,
];

function parseEntityNamesFromErd(erdCode: string): string[] {
  // Only parse the erDiagram block — %%rule/%%workflow sections contain flowchart
  // nodes (single uppercase letters like B{condition?}) that must not be treated
  // as entities.
  const erdBlockMatch = erdCode.match(/erDiagram([\s\S]*?)(?=\n%%[a-z]|$)/);
  const erdBlock = erdBlockMatch ? erdBlockMatch[0] : erdCode;
  const matches = [...erdBlock.matchAll(/^\s*([A-Za-z_]\w*)\s*\{/gm)];
  return [
    ...new Set(
      matches
        .map((m) => m[1])
        .filter((name): name is string => name !== undefined && name !== "erDiagram")
    ),
  ];
}

function EnhancePage() {
  const navigate = useNavigate();
  const { id: projectId } = Route.useParams();

  const { getProject, loadProject, setCurrentStep, currentProject, isLoading } = useProjectStore();
  const project = getProject(projectId) || currentProject;

  useEffect(() => {
    if (!getProject(projectId) && !currentProject) {
      loadProject(projectId);
    }
  }, [projectId, getProject, currentProject, loadProject]);

  const [services, setServices] = useState<ServiceInfo[]>([]);
  // Project.erdCode is declared on the type but no API ever populates it — the
  // ERD lives in erd_versions and the design step reads it from there. Deriving
  // services from project.erdCode therefore always produced zero services and
  // the "generate your project code first" empty state, even right after a
  // successful generation. Load the current version instead.
  const [erdCode, setErdCode] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    erdVersionsApi
      .getAll(projectId)
      .then((versions) => {
        if (cancelled) return;
        const current =
          versions.find((v) => v.is_current) ??
          [...versions].sort((a, b) => b.version_number - a.version_number)[0];
        setErdCode(current?.mermaid_code ?? "");
      })
      .catch((error) => {
        console.error("Failed to load ERD versions:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (project) {
      setCurrentStep("enhance");

      const source = erdCode || project.erdCode || "";
      const entityNames = source ? parseEntityNamesFromErd(source) : [];

      const derivedServices: ServiceInfo[] = entityNames.map((entity, i) => ({
        name: `${entity}Service`,
        entity,
        description: `Manage ${entity} records, business logic, and related operations`,
        icon: ICON_CYCLE[i % ICON_CYCLE.length]!(i),
        hooksCount:
          project.workflows?.filter((w) => w.serviceName === `${entity}Service`).length || 0,
      }));

      setServices(derivedServices);
    }
  }, [project, setCurrentStep, erdCode]);

  const handleServiceClick = (serviceName: string) => {
    try {
      navigate({
        to: "/projects/$id/enhance/$serviceName",
        params: { id: projectId, serviceName },
      });
    } catch (error) {
      console.error("Navigation error:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 animate-pulse" style={{ color: "#FF8400" }} />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-background/80 backdrop-blur-md border-b border-border sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <WizardStepHeader
            stepNumber={5}
            title="Add Features to Your App"
            description="Extend your generated application with AI-assisted features like authentication, validation, testing, and custom business logic. Select a service to define workflows and enhance."
            estimatedTime="5-10 min"
          />

          <ProgressStepper
            currentStep="enhance"
            onStepClick={(step) => {
              if (step === "init") {
                navigate({ to: "/projects/$id/init", params: { id: projectId } });
              } else if (step === "design") {
                navigate({ to: "/projects/$id/design", params: { id: projectId } });
              } else if (step === "logic") {
                navigate({ to: "/projects/$id/logic", params: { id: projectId } });
              } else if (step === "generate") {
                navigate({ to: "/projects/$id/generate", params: { id: projectId } });
              } else if (step === "deploy") {
                navigate({ to: "/projects/$id/deploy", params: { id: projectId } });
              }
            }}
          />

          <JourneyArc currentStep="enhance" />
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="max-w-[1800px] mx-auto px-6 py-12">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">Available Services</h2>
            <p className="text-muted-foreground">
              Choose a service to define business logic hooks and workflows
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {services.length > 0 ? (
              services.map((service) => (
                <button
                  type="button"
                  key={service.name}
                  onClick={() => {
                    console.log("Service clicked:", service.name);
                    handleServiceClick(service.name);
                  }}
                  className="group relative bg-card hover:bg-primary/5 border-2 border-border hover:border-primary rounded-2xl p-6 transition-all duration-200 text-left cursor-pointer active:scale-95"
                  style={{ "--tw-ring-color": "#FF8400" } as React.CSSProperties}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-muted group-hover:bg-primary/10 rounded-xl transition-colors">
                      <div style={{ color: "#FF8400" }}>{service.icon}</div>
                    </div>
                    <ArrowRight
                      className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors"
                      style={{ "--tw-hover-color": "#FF8400" } as React.CSSProperties}
                    />
                  </div>

                  <h3 className="text-xl font-bold text-foreground mb-2">{service.name}</h3>

                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {service.description}
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {service.hooksCount} {service.hooksCount === 1 ? "hook" : "hooks"}
                      </span>
                    </div>
                    <span
                      className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "#FF8400" }}
                    >
                      Configure →
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="col-span-full text-center py-20">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-muted rounded-full mb-4">
                  <Code className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  No Services Available
                </h3>
                <p className="text-muted-foreground mb-6">
                  Generate your project code first to create services
                </p>
                <button
                  type="button"
                  onClick={() =>
                    navigate({ to: "/projects/$id/generate", params: { id: projectId } })
                  }
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/25 transition-all"
                  style={{ backgroundColor: "#FF8400" }}
                >
                  <Zap className="w-4 h-4" />
                  Go to Generate
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
