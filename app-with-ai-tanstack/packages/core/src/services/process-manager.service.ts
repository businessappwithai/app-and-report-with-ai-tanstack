/**
 * Process Manager Service
 * Manages child processes for running generated projects
 */

import { type ChildProcess, execSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface RunningProcess {
  process: ChildProcess;
  projectId: string;
  port: number;
  startTime: Date;
  type: "frontend" | "backend";
}

// Reserved ports that should not be used by generated projects
const RESERVED_PORTS = [3000]; // Port 3000 is reserved for the generator application

export class ProcessManagerService {
  private runningProcesses: Map<string, RunningProcess> = new Map();

  /**
   * Check if a port is reserved
   */
  private isPortReserved(port: number): boolean {
    return RESERVED_PORTS.includes(port);
  }

  /**
   * Find process using a specific port
   */
  private async findProcessOnPort(port: number): Promise<string | null> {
    try {
      // Try to get the PID of the process using the port
      const command =
        process.platform === "win32" ? `netstat -ano | findstr :${port}` : `lsof -ti:${port}`;

      const result = execSync(command, { encoding: "utf-8" });
      const pid = result.trim().split("\n")[0];

      if (pid && pid !== "") {
        return pid.trim();
      }

      return null;
    } catch (_error) {
      // No process found on this port (lsof returns empty when nothing is listening)
      return null;
    }
  }

  /**
   * Kill a process by PID
   */
  private async killProcess(pid: string): Promise<boolean> {
    try {
      const killCommand =
        process.platform === "win32" ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`;
      execSync(killCommand);
      console.log(`Killed process ${pid} using port`);
      await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for port to be released
      return true;
    } catch (error) {
      console.error(`Failed to kill process ${pid}:`, error);
      return false;
    }
  }

  /**
   * Clear a port by killing any process using it
   */
  async clearPort(port: number): Promise<{ success: boolean; message: string }> {
    // Check if port is reserved
    if (this.isPortReserved(port)) {
      return {
        success: false,
        message: `Port ${port} is reserved and cannot be used`,
      };
    }

    // Find and kill any process using this port
    const pid = await this.findProcessOnPort(port);
    if (pid) {
      const killed = await this.killProcess(pid);
      if (killed) {
        return {
          success: true,
          message: `Port ${port} cleared successfully`,
        };
      } else {
        return {
          success: false,
          message: `Failed to clear port ${port}. Process ${pid} is using it.`,
        };
      }
    }

    // Port is already free
    return {
      success: true,
      message: `Port ${port} is available`,
    };
  }

  /**
   * Read PORT from generated project's .env file
   */
  private getPortFromEnvFile(projectDir: string): number {
    const envPath = join(projectDir, ".env");

    if (!existsSync(envPath)) {
      throw new Error(`No .env file found at ${envPath}. Project may not be properly generated.`);
    }

    const envContent = readFileSync(envPath, "utf-8");
    const portMatch = envContent.match(/^PORT=(.+)$/m);

    if (!portMatch) {
      throw new Error(`No PORT variable found in .env file at ${envPath}`);
    }

    const portValue = portMatch[1] ?? "";
    const port = parseInt(portValue, 10);
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid PORT value in .env file: ${portValue}`);
    }

    return port;
  }

  /**
   * Ensure dependencies are installed
   */
  private async ensureDependencies(
    projectDir: string,
    type: "frontend" | "backend" = "backend"
  ): Promise<void> {
    const nodeModulesPath = join(projectDir, "node_modules");

    if (!existsSync(nodeModulesPath)) {
      console.log(`[${projectDir}] Installing dependencies...`);
      try {
        // Use bun for frontend, npm for backend (ts-node-dev compatibility)
        const installCmd = type === "frontend" ? "bun install" : "npm install";
        execSync(installCmd, { cwd: projectDir, stdio: "inherit" });
        console.log(`[${projectDir}] Dependencies installed successfully`);
      } catch (error) {
        console.error(`[${projectDir}] Failed to install dependencies:`, error);
        throw new Error("Failed to install dependencies");
      }
    }
  }

  /**
   * Start a project server
   */
  async startProject(
    projectId: string,
    projectPath: string,
    _port: number,
    type: "frontend" | "backend" = "backend"
  ): Promise<{ success: boolean; url: string; error?: string }> {
    try {
      // Check if project directory exists
      const fullPath = join(process.cwd(), "generated-projects", projectId, projectPath);
      if (!existsSync(fullPath)) {
        return {
          success: false,
          url: "",
          error: `Project directory not found: ${fullPath}`,
        };
      }

      // Read port from .env file (this is the source of truth)
      const envPort = this.getPortFromEnvFile(fullPath);
      console.log(`[${projectId}] Using port ${envPort} from .env file`);

      // Check if port is reserved
      const reservedCheck = this.isPortReserved(envPort);
      if (reservedCheck) {
        return {
          success: false,
          url: "",
          error: `Port ${envPort} is reserved for the generator application and cannot be used`,
        };
      }

      // Clear the port before starting
      console.log(`[${projectId}] Clearing port ${envPort}...`);
      const clearResult = await this.clearPort(envPort);
      if (!clearResult.success) {
        return {
          success: false,
          url: "",
          error: clearResult.message,
        };
      }
      console.log(`[${projectId}] ${clearResult.message}`);

      // Ensure dependencies are installed
      await this.ensureDependencies(fullPath, type);

      // Check if already running
      if (this.runningProcesses.has(projectId)) {
        const running = this.runningProcesses.get(projectId);
        return {
          success: true,
          url: `http://localhost:${running?.port || envPort}`,
        };
      }

      // Determine start command based on type
      let command: string;
      let args: string[];
      const isNestJs = type === "backend";

      if (isNestJs) {
        // For NestJS backend or OData backend - use npm for ts-node-dev compatibility
        command = "npm";
        args = ["run", "start:dev"];
      } else {
        // For TanStack Start frontend or OpenUI5 frontend - use bun
        command = "bun";
        args = ["run", "dev"];
      }

      // Spawn the process
      const childProcess = spawn(command, args, {
        cwd: fullPath,
        stdio: "pipe",
        env: {
          ...process.env,
          PORT: envPort.toString(),
        },
      });

      // Handle process output
      childProcess.stdout?.on("data", (data) => {
        console.log(`[${projectId}] ${data.toString()}`);
      });

      childProcess.stderr?.on("data", (data) => {
        console.error(`[${projectId}] ERROR: ${data.toString()}`);
      });

      // Handle process exit
      childProcess.on("exit", (code, signal) => {
        console.log(`[${projectId}] Process exited with code ${code} and signal ${signal}`);
        this.runningProcesses.delete(projectId);
      });

      // Store the process
      this.runningProcesses.set(projectId, {
        process: childProcess,
        projectId,
        port: envPort, // Use port from .env file
        startTime: new Date(),
        type,
      });

      // Wait a bit for the server to start
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Check if process is still running
      if (childProcess.pid && childProcess.exitCode === null) {
        return {
          success: true,
          url: `http://localhost:${envPort}`,
        };
      } else {
        return {
          success: false,
          url: "",
          error: "Process failed to start or exited immediately",
        };
      }
    } catch (error) {
      console.error("Failed to start project:", error);
      return {
        success: false,
        url: "",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Stop a running project
   */
  async stopProject(projectId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const running = this.runningProcesses.get(projectId);

      if (!running) {
        return {
          success: true,
        };
      }

      // Kill the process
      running.process.kill("SIGTERM");

      // Wait for graceful shutdown
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Force kill if still running
      if (running.process.exitCode === null) {
        running.process.kill("SIGKILL");
      }

      this.runningProcesses.delete(projectId);

      return {
        success: true,
      };
    } catch (error) {
      console.error("Failed to stop project:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Check if a project is running
   */
  isRunning(projectId: string): boolean {
    const running = this.runningProcesses.get(projectId);
    if (!running) return false;

    // Check if process is still alive
    return running.process.exitCode === null;
  }

  /**
   * Get all running processes
   */
  getRunningProcesses(): RunningProcess[] {
    return Array.from(this.runningProcesses.values()).filter((p) => p.process.exitCode === null);
  }

  /**
   * Stop all running processes
   */
  async stopAll(): Promise<void> {
    const processes = this.getRunningProcesses();
    await Promise.all(processes.map((p) => this.stopProject(p.projectId)));
  }
}

// Singleton instance
export const processManagerService = new ProcessManagerService();
