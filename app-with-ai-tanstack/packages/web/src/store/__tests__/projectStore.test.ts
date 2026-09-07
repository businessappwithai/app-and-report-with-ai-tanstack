import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Project, STEP_ORDER } from "../../types/project";
import { useProjectStore } from "../projectStore";

// ---------------------------------------------------------------------------
// Mock the API layer so no real HTTP calls are made
// ---------------------------------------------------------------------------
vi.mock("@/lib/api/projects", () => ({
  projectsApi: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  erdVersionsApi: {
    create: vi.fn(),
    restore: vi.fn(),
  },
  workflowsApi: {
    create: vi.fn(),
    update: vi.fn(),
  },
  deploymentApi: {
    upsert: vi.fn(),
    stop: vi.fn(),
  },
}));

import { erdVersionsApi, projectsApi, workflowsApi } from "@/lib/api/projects";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: "proj-1",
  name: "My Project",
  description: "Test description",
  icon: "🚀",
  iconColor: "#000",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  status: "draft",
  isDeleted: false,
  stackType: "tanstackjs-nestjs",
  port: 3001,
  ...overrides,
});

// Reset store state before each test
beforeEach(() => {
  useProjectStore.setState({
    projects: [],
    currentProject: null,
    currentStep: "init",
    currentActionId: null,
    isLoading: false,
    error: null,
  });
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("projectStore", () => {
  // ── initial state ──────────────────────────────────────────────────────
  describe("initial state", () => {
    it("has sensible defaults", () => {
      const state = useProjectStore.getState();
      expect(state.projects).toEqual([]);
      expect(state.currentProject).toBeNull();
      expect(state.currentStep).toBe("init");
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  // ── loadProjects ────────────────────────────────────────────────────────
  describe("loadProjects", () => {
    it("loads projects and stores them", async () => {
      const projects = [makeProject(), makeProject({ id: "proj-2", name: "Other" })];
      vi.mocked(projectsApi.getAll).mockResolvedValue(projects);

      await act(async () => {
        await useProjectStore.getState().loadProjects();
      });

      const { projects: stored, isLoading, error } = useProjectStore.getState();
      expect(stored).toEqual(projects);
      expect(isLoading).toBe(false);
      expect(error).toBeNull();
    });

    it("sets error when API call fails", async () => {
      vi.mocked(projectsApi.getAll).mockRejectedValue(new Error("Network error"));

      await act(async () => {
        await useProjectStore.getState().loadProjects();
      });

      const { error, isLoading } = useProjectStore.getState();
      expect(error).toBe("Network error");
      expect(isLoading).toBe(false);
    });
  });

  // ── loadProject ─────────────────────────────────────────────────────────
  describe("loadProject", () => {
    it("fetches a single project and sets currentProject", async () => {
      const project = makeProject();
      vi.mocked(projectsApi.getById).mockResolvedValue(project);

      await act(async () => {
        await useProjectStore.getState().loadProject("proj-1");
      });

      expect(useProjectStore.getState().currentProject).toEqual(project);
    });

    it("sets error on failure", async () => {
      vi.mocked(projectsApi.getById).mockRejectedValue(new Error("Not found"));

      await act(async () => {
        await useProjectStore.getState().loadProject("proj-x");
      });

      expect(useProjectStore.getState().error).toBe("Not found");
    });
  });

  // ── getProject ──────────────────────────────────────────────────────────
  describe("getProject", () => {
    it("finds a project by id from local state", () => {
      const p = makeProject();
      useProjectStore.setState({ projects: [p] });

      expect(useProjectStore.getState().getProject("proj-1")).toEqual(p);
    });

    it("returns undefined for unknown id", () => {
      useProjectStore.setState({ projects: [makeProject()] });
      expect(useProjectStore.getState().getProject("nope")).toBeUndefined();
    });

    it("returns undefined for soft-deleted projects", () => {
      useProjectStore.setState({ projects: [makeProject({ isDeleted: true })] });
      expect(useProjectStore.getState().getProject("proj-1")).toBeUndefined();
    });
  });

  // ── addProject ──────────────────────────────────────────────────────────
  describe("addProject", () => {
    it("creates a project and prepends it to the list", async () => {
      const existing = makeProject({ id: "proj-old" });
      useProjectStore.setState({ projects: [existing] });

      const newProject = makeProject({ id: "proj-new", name: "New" });
      vi.mocked(projectsApi.create).mockResolvedValue(newProject);

      let returned: Project | undefined;
      await act(async () => {
        returned = await useProjectStore.getState().addProject({ name: "New" });
      });

      const { projects, currentProject } = useProjectStore.getState();
      expect(returned).toEqual(newProject);
      expect(projects[0]).toEqual(newProject); // prepended
      expect(projects).toHaveLength(2);
      expect(currentProject).toEqual(newProject);
    });

    it("throws and sets error when API fails", async () => {
      vi.mocked(projectsApi.create).mockRejectedValue(new Error("Create failed"));

      let thrownError: Error | undefined;
      await act(async () => {
        try {
          await useProjectStore.getState().addProject({ name: "Boom" });
        } catch (e) {
          thrownError = e as Error;
        }
      });

      expect(thrownError?.message).toBe("Create failed");
      expect(useProjectStore.getState().error).toBe("Create failed");
    });
  });

  // ── updateProject ───────────────────────────────────────────────────────
  describe("updateProject", () => {
    it("updates a project in the list and currentProject", async () => {
      const original = makeProject();
      const updated = { ...original, name: "Updated Name" };
      useProjectStore.setState({ projects: [original], currentProject: original });
      vi.mocked(projectsApi.update).mockResolvedValue(updated);

      await act(async () => {
        await useProjectStore.getState().updateProject("proj-1", { name: "Updated Name" });
      });

      const state = useProjectStore.getState();
      expect(state.projects[0]?.name).toBe("Updated Name");
      expect(state.currentProject?.name).toBe("Updated Name");
    });
  });

  // ── deleteProject ───────────────────────────────────────────────────────
  describe("deleteProject", () => {
    it("removes the project from the list", async () => {
      const p1 = makeProject({ id: "p1" });
      const p2 = makeProject({ id: "p2" });
      useProjectStore.setState({ projects: [p1, p2] });
      vi.mocked(projectsApi.delete).mockResolvedValue(undefined);

      await act(async () => {
        await useProjectStore.getState().deleteProject("p1");
      });

      const { projects } = useProjectStore.getState();
      expect(projects).toHaveLength(1);
      expect(projects[0]?.id).toBe("p2");
    });

    it("clears currentProject when the current project is deleted", async () => {
      const p = makeProject();
      useProjectStore.setState({ projects: [p], currentProject: p });
      vi.mocked(projectsApi.delete).mockResolvedValue(undefined);

      await act(async () => {
        await useProjectStore.getState().deleteProject("proj-1");
      });

      expect(useProjectStore.getState().currentProject).toBeNull();
    });
  });

  // ── setCurrentProject ───────────────────────────────────────────────────
  describe("setCurrentProject", () => {
    it("sets currentProject from local state by id", () => {
      const p = makeProject();
      useProjectStore.setState({ projects: [p] });

      useProjectStore.getState().setCurrentProject("proj-1");
      expect(useProjectStore.getState().currentProject).toEqual(p);
    });

    it("clears currentProject when null is passed", () => {
      useProjectStore.setState({ currentProject: makeProject() });

      useProjectStore.getState().setCurrentProject(null);
      expect(useProjectStore.getState().currentProject).toBeNull();
    });
  });

  // ── setCurrentStep ──────────────────────────────────────────────────────
  describe("setCurrentStep", () => {
    it("updates currentStep", () => {
      useProjectStore.getState().setCurrentStep("design");
      expect(useProjectStore.getState().currentStep).toBe("design");
    });
  });

  // ── goToNextStep / goToPreviousStep ─────────────────────────────────────
  describe("step navigation", () => {
    it("advances to the next step", () => {
      useProjectStore.setState({ currentStep: "init" });
      useProjectStore.getState().goToNextStep();
      expect(useProjectStore.getState().currentStep).toBe("design");
    });

    it("does not advance past the last step", () => {
      useProjectStore.setState({ currentStep: "deploy" });
      useProjectStore.getState().goToNextStep();
      expect(useProjectStore.getState().currentStep).toBe("deploy");
    });

    it("goes back to the previous step", () => {
      useProjectStore.setState({ currentStep: "generate" });
      useProjectStore.getState().goToPreviousStep();
      expect(useProjectStore.getState().currentStep).toBe("logic");
    });

    it("does not go before the first step", () => {
      useProjectStore.setState({ currentStep: "init" });
      useProjectStore.getState().goToPreviousStep();
      expect(useProjectStore.getState().currentStep).toBe("init");
    });

    // Navigation follows STEP_ORDER rather than a list kept here. The two used
    // to disagree — the store skipped the rules step the stepper displayed, so
    // "next" from design jumped past it.
    it("traverses all steps in order", () => {
      useProjectStore.setState({ currentStep: STEP_ORDER[0] });

      for (let i = 1; i < STEP_ORDER.length; i++) {
        useProjectStore.getState().goToNextStep();
        expect(useProjectStore.getState().currentStep).toBe(STEP_ORDER[i]);
      }
    });

    // Rules and processes are authored on one screen, so the wizard has one
    // step for them. They were two, and moving between a rule and the process
    // that reads its decision meant leaving the page and coming back.
    it("visits the logic step the wizard displays", () => {
      expect(STEP_ORDER).toContain("logic");
      expect(STEP_ORDER).not.toContain("rules");
      expect(STEP_ORDER).not.toContain("workflows");
    });
  });

  // ── updateErdCode ───────────────────────────────────────────────────────
  describe("updateErdCode", () => {
    it("creates a version and reloads the project", async () => {
      const project = makeProject({ erdCode: "erDiagram\n  User {}" });
      vi.mocked(erdVersionsApi.create).mockResolvedValue({
        id: "v1",
        project_id: "proj-1",
        version_number: 1,
        mermaid_code: "erDiagram\n  Updated {}",
        description: null,
        is_current: true,
        validation_errors: null,
        created_by: "user",
        created_at: "2024-01-01T00:00:00Z",
      });
      vi.mocked(projectsApi.getById).mockResolvedValue(project);

      await act(async () => {
        await useProjectStore.getState().updateErdCode("proj-1", "erDiagram\n  Updated {}");
      });

      expect(erdVersionsApi.create).toHaveBeenCalledWith("proj-1", {
        mermaidCode: "erDiagram\n  Updated {}",
        description: undefined,
        createdBy: "user",
      });
      expect(projectsApi.getById).toHaveBeenCalledWith("proj-1");
    });
  });

  // ── addWorkflow ─────────────────────────────────────────────────────────
  describe("addWorkflow", () => {
    it("creates a workflow and reloads the project", async () => {
      const project = makeProject();
      vi.mocked(workflowsApi.create).mockResolvedValue({
        id: "wf-1",
        name: "Approve",
        serviceName: "UserService",
        mermaidCode: "graph TD\n  A-->B",
      });
      vi.mocked(projectsApi.getById).mockResolvedValue(project);

      await act(async () => {
        await useProjectStore.getState().addWorkflow("proj-1", {
          name: "Approve",
          serviceName: "UserService",
          mermaidCode: "graph TD\n  A-->B",
        });
      });

      expect(workflowsApi.create).toHaveBeenCalledTimes(1);
      expect(projectsApi.getById).toHaveBeenCalledWith("proj-1");
    });
  });

  // ── updateWorkflow ──────────────────────────────────────────────────────
  describe("updateWorkflow", () => {
    it("updates a workflow and reloads the project", async () => {
      const project = makeProject();
      vi.mocked(workflowsApi.update).mockResolvedValue({
        id: "wf-1",
        name: "Approve Updated",
        serviceName: "UserService",
        mermaidCode: "graph TD\n  A-->B-->C",
      });
      vi.mocked(projectsApi.getById).mockResolvedValue(project);

      await act(async () => {
        await useProjectStore.getState().updateWorkflow("proj-1", "wf-1", {
          name: "Approve Updated",
        });
      });

      expect(workflowsApi.update).toHaveBeenCalledWith("proj-1", "wf-1", {
        name: "Approve Updated",
      });
    });
  });
});
