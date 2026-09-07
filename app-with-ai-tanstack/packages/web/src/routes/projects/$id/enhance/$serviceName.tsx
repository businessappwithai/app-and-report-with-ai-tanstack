import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Code,
  Download,
  FileCode,
  GitBranch,
  Loader2,
  Save,
  Settings,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AutomationBuilder } from "@/components/automation/AutomationBuilder";
import { ProgressStepper } from "@/components/ProgressStepper";
import { parseAutomation, serializeAutomation } from "@/lib/automation/model";
import { requestContext } from "@/lib/request-context";
import { generateFlowchartFromHooks, type ParsedHookDefinition } from "@/lib/workflow/hook-parser";
import { useProjectStore } from "@/store/projectStore";

async function checkAuthMe() {
  const { baseUrl, fetchInit } = await requestContext();
  const res = await fetch(`${baseUrl}/api/auth/me`, fetchInit);
  return res.json() as Promise<{ user: { id: string; email: string; role: string } | null }>;
}

export const Route = createFileRoute("/projects/$id/enhance/$serviceName")({
  beforeLoad: async () => {
    try {
      const data = await checkAuthMe();
      if (!data.user) throw redirect({ to: "/login" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
      throw redirect({ to: "/login" });
    }
  },
  component: ServiceWorkflowPage,
});

interface HookDefinition {
  type: HookType;
  name: string;
  entity: string;
  enabled: boolean;
  code?: string;
  order: number;
}

type HookType =
  | "beforeCreate"
  | "afterCreate"
  | "beforeUpdate"
  | "afterUpdate"
  | "beforeDelete"
  | "afterDelete"
  | "beforeQuery"
  | "afterQuery"
  | "customValidate"
  | "beforeRead"
  | "afterRead"
  | "beforeList"
  | "afterList";

type WorkflowState = "draft" | "validated" | "saved" | "generated";

interface HookWorkflow {
  id: string;
  serviceName: string;
  hooks: HookDefinition[];
  flowchartCode: string;
  isDraft: boolean;
  lastModified: string;
  description?: string;
}

interface GeneratedHookFile {
  fileName: string;
  hookType: HookType;
  hookName: string;
  code: string;
}

const HOOK_TEMPLATES: { [key in HookType]: string } = {
  beforeCreate: `// BEFORE CREATE: Validate & transform data
if (!data.email || !data.email.includes('@')) {
  throw new Error('Valid email required');
}
return {
  ...data,
  email: data.email.toLowerCase(),
  status: 'active',
};`,

  afterCreate: `// AFTER CREATE: Send welcome email
await sendEmail({
  to: data.email,
  subject: 'Welcome!',
  body: 'Hi ' + data.name + ', thanks for joining!',
});
console.log('User created: ' + data.id);`,

  beforeUpdate: `// BEFORE UPDATE: Validate changes
if (data.email && data.email !== existingUser.email) {
  throw new Error('Email changes require verification');
}
return data;`,

  afterUpdate: `// AFTER UPDATE: Log changes
console.log('User updated:', {
  userId: data.id,
  changes: changedFields,
  timestamp: new Date(),
});`,

  beforeDelete: `// BEFORE DELETE: Soft delete instead of removing
return {
  ...data,
  deleted: true,
  deletedAt: new Date(),
};`,

  afterDelete: `// AFTER DELETE: Clean up
await deleteUserPreferences(userId);
await deleteSessions(userId);
console.log('User ' + userId + ' deleted');`,

  beforeQuery: `// BEFORE QUERY: Filter by permissions
if (currentUser.role !== 'admin') {
  return {
    ...query,
    where: { id: currentUser.id }
  };
}
return query;`,

  afterQuery: `// AFTER QUERY: Transform results
return users.map(user => ({
  ...user,
  isAdmin: user.role === 'admin',
  accountAge: new Date() - user.createdAt,
}));`,

  customValidate: `// CUSTOM VALIDATION: Business logic
if (data.age && data.age < 18) {
  throw new Error('Must be 18 or older');
}
const existing = await findByEmail(data.email);
if (existing && existing.id !== userId) {
  throw new Error('Email already in use');
}`,

  beforeRead: `// BEFORE READ: Check permissions
if (currentUser.id !== recordId && !currentUser.isAdmin) {
  throw new Error('Not authorized');
}
return query;`,

  afterRead: `// AFTER READ: Mask sensitive data
if (currentUser.role !== 'admin') {
  delete record.ssn;
  delete record.bankAccount;
}
return record;`,

  beforeList: `// BEFORE LIST: Only show active users
return {
  ...query,
  where: {
    ...query.where,
    deleted: false,
  }
};`,

  afterList: `// AFTER LIST: Add computed fields
return users.map(user => ({
  ...user,
  initials: user.name.split(' ').map(n => n[0]).join(''),
  isActive: new Date() - user.lastLogin < 30 * 24 * 60 * 60 * 1000,
}));`,
};

const HOOK_TYPES: {
  type: HookType;
  label: string;
  description: string;
  category: string;
  color: string;
}[] = [
  {
    type: "beforeCreate",
    label: "Before Create",
    description: "Validate & transform data before saving a new record",
    category: "Create",
    color: "bg-blue-500",
  },
  {
    type: "afterCreate",
    label: "After Create",
    description: "Run actions after a new record is saved (emails, logging, etc.)",
    category: "Create",
    color: "bg-green-500",
  },
  {
    type: "beforeUpdate",
    label: "Before Update",
    description: "Validate & transform data before updating a record",
    category: "Update",
    color: "bg-yellow-500",
  },
  {
    type: "afterUpdate",
    label: "After Update",
    description: "Run actions after a record is updated",
    category: "Update",
    color: "bg-orange-500",
  },
  {
    type: "beforeDelete",
    label: "Before Delete",
    description: "Prevent deletion based on conditions (soft delete, audit trail)",
    category: "Delete",
    color: "bg-red-500",
  },
  {
    type: "afterDelete",
    label: "After Delete",
    description: "Clean up related data or trigger downstream actions",
    category: "Delete",
    color: "bg-slate-500",
  },
  {
    type: "beforeQuery",
    label: "Before Query",
    description: "Add filters or permissions before executing a search",
    category: "Read",
    color: "bg-purple-500",
  },
  {
    type: "afterQuery",
    label: "After Query",
    description: "Transform or enrich query results",
    category: "Read",
    color: "bg-indigo-500",
  },
  {
    type: "customValidate",
    label: "Custom Validation",
    description: "Add business rules validation beyond standard fields",
    category: "Validation",
    color: "bg-pink-500",
  },
  {
    type: "beforeRead",
    label: "Before Read",
    description: "Add permissions or filters before fetching a single record",
    category: "Read",
    color: "bg-cyan-500",
  },
  {
    type: "afterRead",
    label: "After Read",
    description: "Transform or mask data before returning to client",
    category: "Read",
    color: "bg-teal-500",
  },
  {
    type: "beforeList",
    label: "Before List",
    description: "Add filters or permissions before loading a list",
    category: "Read",
    color: "bg-lime-500",
  },
  {
    type: "afterList",
    label: "After List",
    description: "Sort, filter, or transform list results",
    category: "Read",
    color: "bg-emerald-500",
  },
];

function ServiceWorkflowPage() {
  const navigate = useNavigate();
  const { id: projectId, serviceName } = Route.useParams();

  const { getProject, loadProject, setCurrentStep, goToNextStep, currentProject, isLoading } =
    useProjectStore();
  const project = getProject(projectId) || currentProject;

  useEffect(() => {
    if (!getProject(projectId) && !currentProject) {
      loadProject(projectId);
    }
  }, [projectId, getProject, currentProject, loadProject]);

  const [workflow, setWorkflow] = useState<HookWorkflow>({
    id: `workflow-${Date.now()}`,
    serviceName,
    hooks: [],
    flowchartCode: getDefaultFlowchart(serviceName),
    isDraft: true,
    lastModified: new Date().toISOString(),
  });

  const [selectedHooks, setSelectedHooks] = useState<HookDefinition[]>([]);
  const [flowchartCode, setFlowchartCode] = useState(getDefaultFlowchart(serviceName));
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [workflowState, setWorkflowState] = useState<WorkflowState>("draft");
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [showHooksList, setShowHooksList] = useState(true);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedHookFile[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [showGeneratedCode, setShowGeneratedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<"hooks" | "workflows">("hooks");

  const draftSaveTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const isDirtyRef = useRef(false);

  /**
   * The automation the builder edits.
   *
   * The route's source of truth is still the mermaid in `flowchartCode`, so
   * the ladder reads from it and writes back to it. That keeps the raw editor
   * beside it honest — both panes show the same document.
   */
  const automation = useMemo(
    () => parseAutomation(flowchartCode, serviceName),
    [flowchartCode, serviceName]
  );

  const entities = useMemo(() => {
    if (!project?.erdCode) return [];
    const lines = project.erdCode.split("\n");
    const entityList: Array<{ name: string; attributes: string[] }> = [];
    let currentEntity: { name: string; attributes: string[] } | null = null;

    lines.forEach((line) => {
      const trimmed = line.trim();
      const entityMatch = trimmed.match(/^(\w+)\s*\{/);
      if (entityMatch?.[1] && !trimmed.startsWith("erDiagram")) {
        currentEntity = {
          name: entityMatch[1],
          attributes: [],
        };
      } else if (trimmed === "}" && currentEntity) {
        entityList.push({ ...currentEntity });
        currentEntity = null;
      } else if (currentEntity && trimmed && !trimmed.match(/^\{/)) {
        currentEntity.attributes.push(trimmed);
      }
    });

    return entityList;
  }, [project?.erdCode]);

  useEffect(() => {
    const loadWorkflow = async () => {
      if (project) {
        setCurrentStep("enhance");

        try {
          const response = await fetch(`/api/projects/${projectId}/workflows/${serviceName}`);
          const data = await response.json();

          if (data.success && data.workflow) {
            const loadedWorkflow = {
              id: data.workflow.id,
              serviceName: data.workflow.service_name,
              hooks: data.workflow.hook_definitions || [],
              flowchartCode: data.workflow.flowchart_code || flowchartCode,
              isDraft: data.workflow.is_draft,
              lastModified: data.workflow.updated_at,
            };

            setWorkflow(loadedWorkflow);
            setFlowchartCode(data.workflow.flowchart_code || flowchartCode);
            setSelectedHooks(data.workflow.hook_definitions || []);

            if (!data.workflow.is_draft) {
              setWorkflowState("saved");
              await loadGeneratedFiles();
            }
          }
        } catch (error) {
          console.error("Error loading workflow:", error);
        }
      }
    };

    loadWorkflow();
  }, [project, serviceName, setCurrentStep]);

  const saveDraft = useCallback(() => {
    if (!isDirtyRef.current || selectedHooks.length === 0) return;

    setIsAutoSaving(true);
    const draftKey = `draft-workflow-${projectId}-${serviceName}`;
    const draftData = {
      hooks: selectedHooks,
      flowchartCode,
      savedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(draftKey, JSON.stringify(draftData));
      setLastSaved(new Date());
      isDirtyRef.current = false;
    } catch (error) {
      console.error("Failed to auto-save draft:", error);
    } finally {
      setTimeout(() => setIsAutoSaving(false), 500);
    }
  }, [selectedHooks, flowchartCode, projectId, serviceName]);

  useEffect(() => {
    draftSaveTimerRef.current = setInterval(() => {
      saveDraft();
    }, 30000);

    return () => {
      if (draftSaveTimerRef.current) {
        clearInterval(draftSaveTimerRef.current);
      }
    };
  }, [saveDraft]);

  useEffect(() => {
    isDirtyRef.current = true;
  }, [selectedHooks, flowchartCode]);

  useEffect(() => {
    const draftKey = `draft-workflow-${projectId}-${serviceName}`;
    try {
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft && workflowState === "draft" && selectedHooks.length === 0) {
        const draftData = JSON.parse(savedDraft);
        if (draftData.hooks && draftData.hooks.length > 0) {
          setSelectedHooks(draftData.hooks);
          if (draftData.flowchartCode) {
            setFlowchartCode(draftData.flowchartCode);
          }
          if (draftData.savedAt) {
            setLastSaved(new Date(draftData.savedAt));
          }
        }
      }
    } catch (error) {
      console.error("Failed to load draft:", error);
    }
  }, [projectId, serviceName]);

  const loadGeneratedFiles = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/workflows/${serviceName}/files`);
      const data = await response.json();

      if (data.success && data.files) {
        setGeneratedFiles(data.files);
        if (data.files.length > 0) {
          setWorkflowState("generated");
          setShowGeneratedCode(true);
        }
      }
    } catch (error) {
      console.error("Error loading generated files:", error);
    }
  };

  const handleAddHook = (hookType: HookType) => {
    const entityName = serviceName.replace("Service", "");

    const newHook: HookDefinition = {
      type: hookType,
      name: `${hookType}${entityName}`,
      entity: entityName,
      enabled: true,
      code: HOOK_TEMPLATES[hookType] || `// ${hookType} hook for ${entityName}`,
      order: selectedHooks.length,
    };

    setSelectedHooks([...selectedHooks, newHook]);
    updateFlowchartWithHooks([...selectedHooks, newHook]);
    setWorkflowState("draft");
    setValidationErrors([]);
  };

  const handleRemoveHook = (hookIndex: number) => {
    const updatedHooks = selectedHooks.filter((_, idx) => idx !== hookIndex);
    setSelectedHooks(updatedHooks);
    updateFlowchartWithHooks(updatedHooks);
    setWorkflowState("draft");
    setValidationErrors([]);
  };

  const handleHookCodeChange = (hookIndex: number, code: string) => {
    const updatedHooks = [...selectedHooks];
    if (updatedHooks[hookIndex]) {
      updatedHooks[hookIndex] = {
        ...updatedHooks[hookIndex],
        code,
      };
    }
    setSelectedHooks(updatedHooks);
    setWorkflowState("draft");
    setValidationErrors([]);
  };

  const updateFlowchartWithHooks = (hooks: HookDefinition[]) => {
    const entityName = serviceName.replace("Service", "");

    const parsedHooks: ParsedHookDefinition[] = hooks.map((hook) => ({
      type: hook.type,
      name: hook.name,
      entity: hook.entity,
      order: hook.order,
      rawComment: `%%hook ${hook.type} ${hook.name} on ${hook.entity}`,
    }));

    const flowchart = generateFlowchartFromHooks(entityName, parsedHooks);

    setFlowchartCode(flowchart);
    setWorkflow({ ...workflow, flowchartCode: flowchart, hooks });
  };

  const handleValidate = async () => {
    setIsValidating(true);
    setValidationErrors([]);

    try {
      const response = await fetch(
        `/api/projects/\${projectId}/workflows/\${serviceName}/validate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hooks: selectedHooks,
            flowchartCode,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setWorkflowState("validated");
        setTimeout(() => setIsValidating(false), 500);
      } else {
        if (data.validationErrors && data.validationErrors.length > 0) {
          setValidationErrors(data.validationErrors);
        }
        throw new Error(data.error || "Validation failed");
      }
    } catch (error) {
      console.error("Validation error:", error);
      setIsValidating(false);
      setWorkflowState("draft");
      alert(`Validation failed: \${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const handleSave = async () => {
    if (workflowState !== "validated") {
      alert("Please validate the workflow before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/\${projectId}/workflows/\${serviceName}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hooks: selectedHooks,
          flowchartCode,
          description: `\${serviceName} hooks workflow`,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const updatedWorkflow: HookWorkflow = {
          ...workflow,
          flowchartCode,
          hooks: selectedHooks,
          isDraft: false,
          lastModified: new Date().toISOString(),
        };

        setWorkflow(updatedWorkflow);
        setWorkflowState("saved");
        setLastSaved(new Date());

        const draftKey = `draft-workflow-\${projectId}-\${serviceName}`;
        localStorage.removeItem(draftKey);

        setTimeout(() => setIsSaving(false), 500);
      } else {
        throw new Error(data.error || "Failed to save workflow");
      }
    } catch (error) {
      console.error("Save error:", error);
      setIsSaving(false);
      alert(
        `Failed to save workflow: \${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const handleGenerate = async () => {
    if (workflowState !== "saved") {
      alert("Please save the workflow before generating code.");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch(
        `/api/projects/\${projectId}/workflows/\${serviceName}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hooks: selectedHooks,
            flowchartCode,
          }),
        }
      );

      const data = await response.json();

      if (data.success && data.files) {
        setGeneratedFiles(data.files);
        setWorkflowState("generated");
        setShowGeneratedCode(true);
        setSelectedFileIndex(0);
        setTimeout(() => setIsGenerating(false), 500);
      } else {
        throw new Error(data.error || "Failed to generate code");
      }
    } catch (error) {
      console.error("Generation error:", error);
      setIsGenerating(false);
      alert(
        `Failed to generate code: \${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const handleFileCodeChange = (fileIndex: number, newCode: string) => {
    const updatedFiles = [...generatedFiles];
    if (updatedFiles[fileIndex]) {
      updatedFiles[fileIndex].code = newCode;
    }
    setGeneratedFiles(updatedFiles);
  };

  const handleSaveFile = async (fileIndex: number) => {
    const file = generatedFiles[fileIndex];
    if (!file) return;

    try {
      const response = await fetch(
        `/api/projects/\${projectId}/workflows/\${serviceName}/files/\${file.fileName}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: file.code,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        alert(`File \${file.fileName} saved successfully!`);
      } else {
        throw new Error(data.error || "Failed to save file");
      }
    } catch (error) {
      console.error("Save file error:", error);
      alert(`Failed to save file: \${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const handleDownloadFile = (file: GeneratedHookFile) => {
    const blob = new Blob([file.code], { type: "text/typescript" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleContinue = async () => {
    goToNextStep();
    navigate({ to: "/projects/$id/deploy", params: { id: projectId } });
  };

  const getStateBadge = () => {
    switch (workflowState) {
      case "draft":
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm">
            <Clock className="w-4 h-4" />
            Draft
          </div>
        );
      case "validated":
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Validated
          </div>
        );
      case "saved":
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm">
            <Save className="w-4 h-4" />
            Saved
          </div>
        );
      case "generated":
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg text-sm">
            <Code className="w-4 h-4" />
            Generated
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          <p className="text-slate-600 dark:text-slate-400">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Project not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-background/80 backdrop-blur-md border-b border-border sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => navigate({ to: "/projects/$id/enhance", params: { id: projectId } })}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{serviceName} Hooks</h1>
                <p className="text-sm text-muted-foreground">
                  Define business logic hooks for {serviceName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {getStateBadge()}

              {isAutoSaving && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Saving draft...
                </div>
              )}
              {!isAutoSaving && lastSaved && (
                <div
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  title={lastSaved.toLocaleString()}
                >
                  <Clock className="w-3 h-3" />
                  Saved {getTimeSince(lastSaved)}
                </div>
              )}

              <div className="flex items-center gap-2 border-l border-border pl-3">
                <button
                  type="button"
                  onClick={handleValidate}
                  disabled={selectedHooks.length === 0 || isValidating}
                  className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#FF8400" }}
                >
                  {isValidating ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Validate
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={workflowState !== "validated" || isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={workflowState !== "saved" || isGenerating}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Code className="w-4 h-4" />
                      Generate
                    </>
                  )}
                </button>
              </div>

              {workflowState === "generated" && (
                <button
                  type="button"
                  onClick={handleContinue}
                  className="flex items-center gap-2 px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-all active:scale-[0.98]"
                >
                  Continue to Deploy
                </button>
              )}
            </div>
          </div>

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
              } else if (step === "enhance") {
                navigate({ to: "/projects/$id/enhance", params: { id: projectId } });
              }
            }}
          />
        </div>
      </header>

      {!showGeneratedCode && (
        <div className="border-b border-border bg-card">
          <div className="max-w-[1800px] mx-auto px-6">
            <div className="flex gap-6">
              <button
                type="button"
                onClick={() => setActiveTab("hooks")}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors \${
                  activeTab === "hooks"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                style={activeTab === "hooks" ? { borderColor: "#FF8400", color: "#FF8400" } : {}}
              >
                <GitBranch className="w-4 h-4 inline mr-2" />
                Hooks
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("workflows")}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors \${
                  activeTab === "workflows"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                style={
                  activeTab === "workflows" ? { borderColor: "#FF8400", color: "#FF8400" } : {}
                }
              >
                <Settings className="w-4 h-4 inline mr-2" />
                Trigger.dev Workflows
              </button>
            </div>
          </div>
        </div>
      )}

      {!showGeneratedCode ? (
        <div className="flex-1 flex overflow-hidden">
          {activeTab === "hooks" ? (
            <>
              <div className="w-1/3 border-r border-border flex flex-col bg-card">
                <div className="flex-1 p-4 border-b border-border overflow-y-auto">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <GitBranch className="w-4 h-4" />
                      Available Hooks
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowHooksList(!showHooksList)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      {showHooksList ? "Hide" : "Show"}
                    </button>
                  </div>

                  {showHooksList && (
                    <div className="space-y-4 mb-4">
                      {["Create", "Update", "Delete", "Read", "Validation"].map((category) => {
                        const categoryHooks = HOOK_TYPES.filter((h) => h.category === category);
                        return (
                          <div key={category}>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                              {category}
                            </h4>
                            <div className="space-y-2">
                              {categoryHooks.map((hook) => {
                                const isActive = selectedHooks.some((h) => h.type === hook.type);
                                return (
                                  <button
                                    type="button"
                                    key={hook.type}
                                    onClick={() => !isActive && handleAddHook(hook.type)}
                                    disabled={isActive}
                                    className={`w-full flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm transition-all \${
                                  isActive
                                    ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                                    : "bg-secondary hover:bg-secondary/80 text-foreground border border-border hover:border-primary/40"
                                }`}
                                    title={hook.description}
                                  >
                                    <div
                                      className={`w-2 h-2 rounded-full \${hook.color} flex-shrink-0 mt-1`}
                                    />
                                    <div className="text-left flex-1 min-w-0">
                                      <div className="font-medium text-foreground">
                                        {hook.label}
                                      </div>
                                      <div className="text-xs text-muted-foreground line-clamp-2">
                                        {hook.description}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <h4 className="text-xs font-semibold text-muted-foreground mb-2 mt-4">
                    Active Hooks ({selectedHooks.length})
                  </h4>

                  <div className="space-y-2">
                    {selectedHooks.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No active hooks. Select hooks from above to add them.
                      </p>
                    ) : (
                      selectedHooks.map((hook, index) => {
                        const hookDef = HOOK_TYPES.find((h) => h.type === hook.type);
                        return (
                          <div
                            key={`\${hook.type}-\${index}`}
                            className="bg-secondary rounded-lg p-3 border border-border"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div
                                  className={`w-2 h-2 rounded-full \${hookDef?.color || "bg-gray-500"} flex-shrink-0`}
                                />
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium text-foreground block">
                                    {hookDef?.label || hook.type}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {hook.name ? `Named: \${hook.name}` : "Unnamed hook"}
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveHook(index)}
                                className="p-1 hover:bg-red-100 dark:hover:bg-red-950/30 rounded transition-colors flex-shrink-0 ml-2"
                              >
                                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                              </button>
                            </div>
                            <textarea
                              value={hook.code}
                              onChange={(e) => handleHookCodeChange(index, e.target.value)}
                              placeholder={`// Implement \${hookDef?.label || hook.type} logic here`}
                              className="w-full h-24 p-2 text-xs font-mono bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col bg-muted">
                <div className="flex-1 p-6 bg-card">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <FileCode className="w-4 h-4" />
                      Flowchart Code
                    </h3>
                  </div>
                  <textarea
                    value={flowchartCode}
                    onChange={(e) => setFlowchartCode(e.target.value)}
                    className="w-full h-full p-4 bg-muted border border-border rounded-xl text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    spellCheck={false}
                    placeholder="Enter Mermaid flowchart syntax here..."
                  />
                </div>
              </div>
            </>
          ) : (
            <AutomationBuilder
              automation={automation}
              onChange={(next) => setFlowchartCode(serializeAutomation(next))}
              entities={entities.map((e) => e.name)}
              entityFields={Object.fromEntries(entities.map((e) => [e.name, e.attributes]))}
            />
          )}
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/3 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <FileCode className="w-4 h-4" />
              Generated Hook Files ({generatedFiles.length})
            </h3>

            <div className="space-y-2">
              {generatedFiles.map((file, index) => (
                <button
                  type="button"
                  key={index}
                  onClick={() => setSelectedFileIndex(index)}
                  className={`w-full text-left p-3 rounded-lg transition-colors \${
                    selectedFileIndex === index
                      ? "bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-500"
                      : "bg-slate-50 dark:bg-slate-900 border-2 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {file.fileName}
                    </span>
                    <div
                      className={`w-2 h-2 rounded-full \${HOOK_TYPES.find((h) => h.type === file.hookType)?.color || "bg-gray-500"}`}
                    />
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {file.hookType}: {file.hookName}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Code className="w-4 h-4" />
                {generatedFiles[selectedFileIndex]?.fileName}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (generatedFiles[selectedFileIndex]) {
                      handleSaveFile(selectedFileIndex);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save File
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (generatedFiles[selectedFileIndex]) {
                      handleDownloadFile(generatedFiles[selectedFileIndex]);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => setShowGeneratedCode(false)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Editor
                </button>
              </div>
            </div>

            {generatedFiles[selectedFileIndex] && (
              <textarea
                value={generatedFiles[selectedFileIndex].code}
                onChange={(e) => handleFileCodeChange(selectedFileIndex, e.target.value)}
                className="flex-1 w-full p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                spellCheck={false}
              />
            )}
          </div>
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/30 border-t border-red-200 dark:border-red-900 p-4">
          <div className="max-w-[1800px] mx-auto">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 dark:text-red-300 mb-1">
                  Validation Errors
                </h3>
                <ul className="text-sm text-red-700 dark:text-red-400 space-y-1">
                  {validationErrors.map((error, idx) => (
                    <li key={idx}>• {error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getDefaultFlowchart(serviceName: string): string {
  const entityName = serviceName.replace("Service", "");
  return `flowchart TD
    A[Client Request] --> B[Validate Request]
    B --> C[Process ${entityName}]
    C --> D[Response]
    D --> E[Return to Client]

    style A fill:#e1f5fe
    style E fill:#c8e6c9`;
}

function getTimeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
