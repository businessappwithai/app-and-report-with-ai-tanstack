export interface Project {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconColor: string;
  createdAt: string;
  updatedAt: string;
  status: "draft" | "active" | "archived";
  isDeleted: boolean;
  ownerId?: string;

  // Configuration (Step 1)
  stackType: "tanstackjs-nestjs";
  port: number;
  databaseUrl?: string;

  // ERD Design (Step 2)
  erdCode?: string;
  erdValidationErrors?: ValidationError[];

  // Generation (Step 3)
  generatedPath?: string;
  deploymentStatus?:
    | "pending"
    | "generating"
    | "completed"
    | "failed"
    | "running"
    | "stopped"
    | "error";

  // Workflow Enhancement (Step 4)
  workflows?: WorkflowDefinition[];

  // Deployment (Step 5)
  deploymentUrl?: string;
  uptime?: string;
}

export interface ValidationError {
  line: number;
  message: string;
  severity: "error" | "warning";
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  serviceName: string;
  mermaidCode: string;
  description?: string;
}

export type ProjectStep = "init" | "design" | "logic" | "generate" | "enhance" | "deploy";

/**
 * Rules and workflows used to be two steps. They are one thing: a rule decides,
 * and what it decides is read by the process that acts on it — often in the
 * same document, now often in the same diagram. Asking someone to finish all
 * the deciding before they may start on any of the doing was an ordering the
 * work does not have.
 */
export const STEP_ORDER: ProjectStep[] = [
  "init",
  "design",
  "logic",
  "generate",
  "enhance",
  "deploy",
];

export const STEP_LABELS: Record<ProjectStep, string> = {
  init: "Init",
  design: "Design",
  logic: "Logic",
  generate: "Gen",
  enhance: "Enhance",
  deploy: "Deploy",
};

/** Where each step lives, so the stepper can navigate without a lookup table per page. */
export const STEP_ROUTES: Record<ProjectStep, string> = {
  init: "/projects/$id/init",
  design: "/projects/$id/design",
  logic: "/projects/$id/logic",
  generate: "/projects/$id/generate",
  enhance: "/projects/$id/enhance",
  deploy: "/projects/$id/deploy",
};

export interface MermaidFile {
  filename: string;
  type: "erd" | "rules";
  projectId: string;
  projectName: string;
  content: string;
  createdAt: string;
  downloadUrl: string;
}

export const STACK_LABELS: Record<Project["stackType"], string> = {
  "tanstackjs-nestjs": "tanstackjs-nestjs: NestJS + TanStack Start",
};
