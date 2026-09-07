import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FileCode2,
  Globe,
  HelpCircle,
  Loader2,
  Plus,
  Rocket,
  Trash2,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { JourneyArc } from "@/components/JourneyArc";
import { ProgressStepper } from "@/components/ProgressStepper";
import { WizardStepHeader } from "@/components/WizardStepHeader";
import { requestContext } from "@/lib/request-context";
import { useProjectStore } from "@/store/projectStore";

async function checkAuthMe() {
  const { baseUrl, fetchInit } = await requestContext();
  const res = await fetch(`${baseUrl}/api/auth/me`, fetchInit);
  return res.json() as Promise<{ user: { id: string; email: string; role: string } | null }>;
}

export const Route = createFileRoute("/projects/$id/deploy")({
  beforeLoad: async () => {
    try {
      const data = await checkAuthMe();
      if (!data.user) throw redirect({ to: "/login" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
      throw redirect({ to: "/login" });
    }
  },
  component: DeployPage,
});

interface EnvVariable {
  key: string;
  value: string;
  isSecret: boolean;
}

interface LogEntry {
  timestamp: string;
  level: "info" | "success" | "error" | "warning";
  message: string;
}

function DeployPage() {
  const navigate = useNavigate();
  const { id: projectId } = Route.useParams();

  const { getProject, loadProject, updateProject, setCurrentStep, currentProject, isLoading } =
    useProjectStore();
  const project = getProject(projectId) || currentProject;

  useEffect(() => {
    if (!getProject(projectId) && !currentProject) {
      loadProject(projectId);
    }
  }, [projectId, getProject, currentProject, loadProject]);

  const [envVars, setEnvVars] = useState<EnvVariable[]>([
    { key: "DATABASE_URL", value: "", isSecret: true },
    { key: "DATABASE_NAME", value: "taskflow", isSecret: false },
    { key: "API_KEY", value: "", isSecret: true },
    { key: "PORT", value: (project?.port || 4001).toString(), isSecret: false },
    { key: "NODE_ENV", value: "production", isSecret: false },
  ]);
  const [showSecrets, setShowSecrets] = useState<{ [key: string]: boolean }>({});
  const [deploymentTarget] = useState<"local">("local");
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentComplete, setDeploymentComplete] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deploymentUrl, setDeploymentUrl] = useState<string>("");
  const [uptime, setUptime] = useState<string>("0s");
  const [serverStatus, setServerStatus] = useState<
    "stopped" | "running" | "starting" | "stopping" | "error"
  >("stopped");
  const [serverPid, setServerPid] = useState<number | null>(null);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const liveLogsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (project) {
      setCurrentStep("deploy");
      if (project.deploymentUrl) {
        setDeploymentUrl(project.deploymentUrl);
        setDeploymentComplete(true);
      }
      if (project.databaseUrl) {
        setEnvVars((vars) =>
          vars.map((v) =>
            v.key === "DATABASE_URL" ? { ...v, value: project.databaseUrl || "" } : v
          )
        );
      }
    }
  }, [project, setCurrentStep]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    liveLogsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveLogs]);

  useEffect(() => {
    if (!deploymentComplete || !projectId) return;

    const pollServerStatus = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/logs`);
        if (response.ok) {
          const data = await response.json();
          if (data.status === "running") {
            setServerStatus("running");
            setServerPid(data.processId);
          } else {
            setServerStatus("stopped");
            setServerPid(null);
          }
        }
      } catch (err) {
        console.error("Failed to poll server status:", err);
        setServerStatus("error");
      }
    };

    pollServerStatus();
    const interval = setInterval(pollServerStatus, 5000);

    return () => clearInterval(interval);
  }, [deploymentComplete, projectId]);

  useEffect(() => {
    if (!deploymentComplete || isDeploying) {
      return undefined;
    }
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      const seconds = elapsed % 60;
      setUptime(
        hours > 0
          ? `${hours}h ${minutes}m ${seconds}s`
          : minutes > 0
            ? `${minutes}m ${seconds}s`
            : `${seconds}s`
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [deploymentComplete, isDeploying]);

  const addLog = (level: LogEntry["level"], message: string) => {
    setLogs((prev) => [
      ...prev,
      {
        timestamp: new Date().toLocaleTimeString(),
        level,
        message,
      },
    ]);
  };

  const handleAddEnvVar = () => {
    setEnvVars([...envVars, { key: "", value: "", isSecret: false }]);
  };

  const handleRemoveEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const handleEnvVarChange = (index: number, field: keyof EnvVariable, value: string | boolean) => {
    setEnvVars(envVars.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  };

  const toggleSecretVisibility = (key: string) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    setDeploymentComplete(false);
    setError(null);
    setLogs([]);

    try {
      addLog("info", "Starting deployment process...");
      addLog("info", `Deployment target: ${deploymentTarget}`);
      addLog("info", "Loading environment variables...");

      const missingRequired = envVars.filter((v) => v.isSecret && !v.value && v.key);
      if (missingRequired.length > 0) {
        throw new Error(
          `Missing required environment variables: ${missingRequired.map((v) => v.key).join(", ")}`
        );
      }

      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          target: deploymentTarget,
          envVars: envVars.filter((v) => v.key && v.value),
          generatedPath: project?.generatedPath,
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      let finalUrl = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((line) => line.trim());

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.log) {
                  addLog(data.level || "info", data.log);
                }
                if (data.complete) {
                  finalUrl = data.url;
                  setDeploymentComplete(true);
                  setDeploymentUrl(data.url);
                  updateProject(projectId, {
                    deploymentUrl: data.url,
                    uptime: "0s",
                  });
                }
                if (data.error) {
                  setError(data.error);
                  addLog("error", data.error);
                }
              } catch (e) {
                console.error("Failed to parse log:", e);
              }
            }
          }
        }
      }

      addLog("success", "Deployment completed successfully!");
      if (finalUrl) {
        addLog("info", `Your application is live at: ${finalUrl}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMsg);
      addLog("error", errorMsg);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleViewApp = () => {
    if (deploymentUrl) {
      window.open(deploymentUrl, "_blank");
    }
  };

  const handleStopServer = async () => {
    try {
      setServerStatus("stopping");
      const response = await fetch(`/api/projects/${projectId}/deployment`, {
        method: "DELETE",
      });

      if (response.ok) {
        setServerStatus("stopped");
        setServerPid(null);
        setLiveLogs([]);
      } else {
        throw new Error("Failed to stop server");
      }
    } catch (err) {
      console.error("Failed to stop server:", err);
      setServerStatus("error");
      addLog("error", "Failed to stop server");
    }
  };

  const handleBackToProjects = () => {
    navigate({ to: "/projects" });
  };

  const shouldLoad = !getProject(projectId) && !currentProject;

  if (isLoading || shouldLoad) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#FF8400" }} />
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
        <div className="max-w-7xl mx-auto px-6 py-4">
          <WizardStepHeader
            stepNumber={6}
            title="Deploy Your Application"
            description="Your application is ready to deploy. Configure your environment variables and watch your app go live with a live preview URL."
            estimatedTime="1-2 min"
          />

          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleViewApp}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/25 transition-all active:scale-[0.98]"
                >
                  <Globe className="w-4 h-4" />
                  Open Local App
                </button>
                {/* The model is the artifact worth keeping: everything designed
                    here — the ERD, the rules, the workflows built in the editor
                    — is merged back into one document, and this is where it
                    leaves as the same kind of file it could be imported from. */}
                <a
                  href={`/api/projects/${projectId}/eml/download`}
                  className="flex items-center gap-2 px-4 py-2 border border-border hover:bg-muted font-semibold rounded-xl transition-all active:scale-[0.98]"
                >
                  <FileCode2 className="w-4 h-4" />
                  Download the model
                </a>
                <button
                  type="button"
                  onClick={handleBackToProjects}
                  className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/25 transition-all active:scale-[0.98]"
                  style={{ backgroundColor: "#FF8400" }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Back to Projects
                </button>
              </div>
            </div>
          </div>

          <ProgressStepper
            currentStep="deploy"
            onStepClick={(step) => {
              if (step === "init") {
                navigate({ to: "/projects/$id/init", params: { id: projectId } });
              } else if (step === "design") {
                navigate({ to: "/projects/$id/design", params: { id: projectId } });
              } else if (step === "logic") {
                navigate({ to: "/projects/$id/logic", params: { id: projectId } });
              } else if (step === "generate") {
                navigate({ to: "/projects/$id/generate", params: { id: projectId } });
              } else if (step === "enhance") {
                navigate({ to: "/projects/$id/enhance", params: { id: projectId } });
              }
            }}
          />

          <JourneyArc currentStep="deploy" />
        </div>
      </header>

      <div className="flex-1 py-8">
        <div className="max-w-7xl mx-auto px-6">
          {!isDeploying && !deploymentComplete && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-foreground">Environment Variables</h2>
                  <button
                    type="button"
                    onClick={handleAddEnvVar}
                    className="flex items-center gap-1 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition-colors"
                    style={{ backgroundColor: "#FF8400" }}
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {envVars.map((envVar, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 bg-muted rounded-xl">
                      <input
                        type="text"
                        value={envVar.key}
                        onChange={(e) => handleEnvVarChange(index, "key", e.target.value)}
                        placeholder="KEY"
                        className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        style={{ "--tw-ring-color": "#FF8400" } as React.CSSProperties}
                      />
                      <div className="relative flex-1">
                        <input
                          type={envVar.isSecret && !showSecrets[envVar.key] ? "password" : "text"}
                          value={envVar.value}
                          onChange={(e) => handleEnvVarChange(index, "value", e.target.value)}
                          placeholder="value"
                          className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-lg text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                          style={{ "--tw-ring-color": "#FF8400" } as React.CSSProperties}
                        />
                        {envVar.isSecret && (
                          <button
                            type="button"
                            onClick={() => toggleSecretVisibility(envVar.key)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded transition-colors"
                          >
                            {showSecrets[envVar.key] ? (
                              <EyeOff className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <Eye className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>
                        )}
                      </div>
                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={envVar.isSecret}
                          onChange={(e) => handleEnvVarChange(index, "isSecret", e.target.checked)}
                          className="rounded"
                        />
                        Secret
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemoveEnvVar(index)}
                        className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6">
                <h2 className="text-xl font-bold text-foreground mb-2">Local Deployment</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Deploy and run the application on your local machine
                </p>

                <button
                  type="button"
                  onClick={handleDeploy}
                  className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg rounded-2xl shadow-lg shadow-primary/25 transition-all active:scale-[0.98]"
                  style={{ backgroundColor: "#FF8400" }}
                >
                  <Rocket className="w-5 h-5" />
                  Deploy Locally
                </button>
              </div>
            </div>
          )}

          {(isDeploying || deploymentComplete || error) && (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  {isDeploying && (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#FF8400" }} />
                      <div className="flex-1">
                        <h2 className="text-xl font-bold text-foreground">
                          Deploying Application...
                        </h2>
                        <p className="text-sm text-muted-foreground">This may take a few moments</p>
                      </div>
                    </>
                  )}
                  {deploymentComplete && !error && (
                    <>
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      <div className="flex-1">
                        <h2 className="text-xl font-bold text-foreground">Deployment Complete!</h2>
                        <p className="text-sm text-muted-foreground">
                          Your application is now live
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                            serverStatus === "running"
                              ? "bg-emerald-500/10"
                              : serverStatus === "stopped"
                                ? "bg-red-500/10"
                                : serverStatus === "starting"
                                  ? "bg-yellow-500/10"
                                  : "bg-muted"
                          }`}
                        >
                          <Activity
                            className={`w-4 h-4 ${
                              serverStatus === "running"
                                ? "text-emerald-500"
                                : serverStatus === "stopped"
                                  ? "text-red-500"
                                  : serverStatus === "starting"
                                    ? "text-yellow-500 animate-pulse"
                                    : "text-muted-foreground"
                            }`}
                          />
                          <span
                            className={`font-medium ${
                              serverStatus === "running"
                                ? "text-emerald-400"
                                : serverStatus === "stopped"
                                  ? "text-red-400"
                                  : serverStatus === "starting"
                                    ? "text-yellow-400"
                                    : "text-muted-foreground"
                            }`}
                          >
                            {serverStatus === "running"
                              ? "Server Running"
                              : serverStatus === "stopped"
                                ? "Server Stopped"
                                : serverStatus === "starting"
                                  ? "Starting..."
                                  : "Unknown"}
                          </span>
                        </div>
                        {serverStatus === "running" && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg">
                            <Clock className="w-4 h-4" style={{ color: "#FF8400" }} />
                            <span className="font-medium" style={{ color: "#FF8400" }}>
                              {uptime}
                            </span>
                          </div>
                        )}
                        {serverPid && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 rounded-lg">
                            <span className="text-xs text-purple-400 font-mono">
                              PID: {serverPid}
                            </span>
                          </div>
                        )}
                      </div>
                      {serverStatus === "running" && (
                        <button
                          type="button"
                          onClick={handleStopServer}
                          className="ml-4 flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-600/25 transition-all active:scale-[0.98]"
                        >
                          <Activity className="w-4 h-4" />
                          Stop Server
                        </button>
                      )}
                    </>
                  )}
                  {error && (
                    <>
                      <AlertCircle className="w-6 h-6 text-red-500" />
                      <div className="flex-1">
                        <h2 className="text-xl font-bold text-foreground">Deployment Failed</h2>
                        <p className="text-sm text-red-400">{error}</p>
                      </div>
                    </>
                  )}
                </div>

                {deploymentComplete && deploymentUrl && (
                  <div className="mt-4 p-4 bg-muted rounded-xl">
                    <p className="text-xs text-muted-foreground mb-2">Live URL:</p>
                    <div className="flex items-center gap-2">
                      <a
                        href={deploymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 font-mono text-sm hover:underline"
                        style={{ color: "#FF8400" }}
                      >
                        {deploymentUrl}
                      </a>
                      <button
                        type="button"
                        onClick={handleViewApp}
                        className="p-2 hover:bg-muted-foreground/10 rounded-lg transition-colors"
                      >
                        <Globe className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-card rounded-2xl p-6 border border-border font-mono text-sm overflow-hidden">
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                  <span className="ml-4 text-muted-foreground">Deployment Logs</span>
                  {isDeploying && (
                    <span
                      className="ml-auto px-3 py-1 text-xs rounded-full font-sans"
                      style={{ backgroundColor: "rgba(255, 132, 0, 0.2)", color: "#FF8400" }}
                    >
                      IN PROGRESS
                    </span>
                  )}
                  {deploymentComplete && (
                    <span className="ml-auto px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full font-sans">
                      COMPLETED
                    </span>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto space-y-2">
                  {logs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 ${
                        log.level === "error"
                          ? "text-red-400"
                          : log.level === "success"
                            ? "text-emerald-400"
                            : log.level === "warning"
                              ? "text-yellow-400"
                              : "text-muted-foreground"
                      }`}
                    >
                      <span className="text-muted-foreground select-none">[{log.timestamp}]</span>
                      <span className="flex-1">{log.message}</span>
                    </div>
                  ))}
                  {isDeploying && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </div>
                  )}
                  <div ref={logsEndRef} />
                </div>
              </div>

              {deploymentComplete && serverStatus === "running" && (
                <div className="bg-card rounded-2xl p-6 border border-border font-mono text-sm overflow-hidden">
                  <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
                    <div className="w-3 h-3 bg-red-500 rounded-full" />
                    <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                    <span className="ml-4 text-muted-foreground">Live Server Logs</span>
                    <span className="ml-auto px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full font-sans">
                      LIVE
                    </span>
                  </div>

                  <div className="max-h-96 overflow-y-auto space-y-1">
                    {liveLogs.length === 0 ? (
                      <div className="text-muted-foreground text-center py-8">
                        Waiting for server output...
                      </div>
                    ) : (
                      liveLogs.map((log, idx) => (
                        <div
                          key={idx}
                          className="text-foreground hover:bg-muted-foreground/5 px-2 py-1 rounded"
                        >
                          <span className="text-muted-foreground mr-2">
                            [{new Date().toLocaleTimeString()}]
                          </span>
                          {log}
                        </div>
                      ))
                    )}
                    <div ref={liveLogsEndRef} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        className="fixed bottom-6 right-6 w-14 h-14 text-white rounded-full shadow-lg shadow-primary/50 flex items-center justify-center transition-all active:scale-95 z-40"
        style={{ backgroundColor: "#FF8400" }}
      >
        <HelpCircle className="w-6 h-6" />
      </button>
    </div>
  );
}
