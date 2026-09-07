/**
 * Deployment API
 * Handles deployment operations with logging
 */

import { deploymentDb, processManagerService, projectDb } from "@appwithai/core/services";
import { addLogEntry, completeActionLog, startActionLog } from "@/lib/action-log";

export const deploymentApi = {
  /**
   * Get deployment status for a project
   */
  async getDeployment(projectId: string) {
    const deployment = await deploymentDb.getDeployment(projectId);
    return { deployment };
  },

  /**
   * Start a project with logging
   */
  async start(projectId: string, port?: number) {
    // Get project details from database
    const project = await projectDb.findById(projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const projectPort = port || project.port;
    const actionId = startActionLog(
      projectId,
      "start",
      `Starting project on port ${projectPort}...`
    );

    try {
      addLogEntry(actionId, "Checking project configuration...", "running");
      addLogEntry(
        actionId,
        `Project: ${project.name}`,
        "running",
        `ID: ${project.id}\nStack: ${project.stackType}\nPath: ${project.generatedPath}`
      );

      addLogEntry(actionId, "Validating generated files...", "running");
      if (!project.generatedPath) {
        throw new Error("Project has not been generated yet. Please generate the project first.");
      }
      addLogEntry(actionId, "Generated files found", "success");

      addLogEntry(actionId, "Installing dependencies...", "running");
      // Start the project server (this will install dependencies as part of the process)
      const result = await processManagerService.startProject(
        projectId,
        "backend",
        projectPort,
        "backend"
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to start server");
      }

      addLogEntry(actionId, "Dependencies installed successfully", "success");
      addLogEntry(
        actionId,
        "Server started successfully",
        "success",
        `URL: ${result.url}\nPort: ${projectPort}`
      );

      // Update deployment in database
      const deployment = await deploymentDb.upsert({
        project_id: projectId,
        status: "running",
        deployment_url: result.url,
        port: projectPort,
        uptime: "0s",
      });

      // Update project with deployment URL
      await projectDb.update(projectId, {
        deployment_url: result.url,
        deploymentStatus: "running",
      });

      completeActionLog(actionId, "success", `Project started successfully on port ${projectPort}`);

      return {
        deployment,
        url: result.url,
        actionId,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to start server";
      addLogEntry(actionId, "Failed to start project", "error", errorMsg);
      completeActionLog(actionId, "error", `Failed to start: ${errorMsg}`);
      throw error;
    }
  },

  /**
   * Stop a project with logging
   */
  async stop(projectId: string) {
    const project = await projectDb.findById(projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const actionId = startActionLog(projectId, "stop", `Stopping project...`);

    try {
      addLogEntry(actionId, "Stopping server process...", "running");

      // Stop the actual server process
      await processManagerService.stopProject(projectId);
      addLogEntry(actionId, "Server process stopped", "success");

      // Update deployment status in database
      await deploymentDb.upsert({
        project_id: projectId,
        status: "stopped",
      });

      // Update project deployment status
      await projectDb.update(projectId, {
        deploymentStatus: "stopped",
      });

      // Delete deployment record
      await deploymentDb.delete(projectId);

      completeActionLog(actionId, "success", "Project stopped successfully");

      return { actionId };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to stop project";
      addLogEntry(actionId, "Failed to stop project", "error", errorMsg);
      completeActionLog(actionId, "error", `Failed to stop: ${errorMsg}`);
      throw error;
    }
  },

  /**
   * Update deployment status
   */
  async upsert(
    projectId: string,
    data: {
      status?: string;
      port?: number;
      deploymentUrl?: string;
      uptime?: string;
    }
  ) {
    const deployment = await deploymentDb.upsert({
      project_id: projectId,
      status: data.status ?? "unknown",
      deployment_url: data.deploymentUrl,
      port: data.port,
      uptime: data.uptime,
    });

    return { deployment };
  },
};
