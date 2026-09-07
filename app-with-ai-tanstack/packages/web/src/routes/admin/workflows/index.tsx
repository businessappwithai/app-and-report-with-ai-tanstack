import { createFileRoute, redirect } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2Icon, Clock, RefreshCwIcon, RotateCwIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { requestContext } from "@/lib/request-context";

interface WorkflowRun {
  id: string;
  entity_name: string;
  entity_id: string;
  operation: string;
  status: "draft" | "running" | "success" | "error";
  error_message?: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

interface WorkflowStep {
  id: string;
  sequence: number;
  name: string;
  type: string;
  status: "pending" | "running" | "success" | "error" | "skipped";
  duration_ms?: number;
}

async function checkAuthMe() {
  const { baseUrl, fetchInit } = await requestContext();
  const res = await fetch(`${baseUrl}/api/auth/me`, fetchInit);
  return res.json() as Promise<{ user: { id: string; email: string; role: string } | null }>;
}

export const Route = createFileRoute("/admin/workflows/")({
  beforeLoad: async () => {
    try {
      const data = await checkAuthMe();
      if (!data.user) throw redirect({ to: "/login" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
      throw redirect({ to: "/login" });
    }
  },
  component: WorkflowMonitorPage,
});

function WorkflowMonitorPage() {
  const [workflows, setWorkflows] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{
    status?: string;
    entity?: string;
  }>({});
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowRun | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "steps" | "logs">("overview");

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.status) params.append("status", filter.status);
      if (filter.entity) params.append("entity", filter.entity);

      const response = await fetch(`/api/workflows?${params}`);
      if (!response.ok) throw new Error("Failed to fetch workflows");

      const data = await response.json();
      setWorkflows(data.workflows || []);
    } catch (error) {
      console.error("Failed to load workflows:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflowSteps = async (workflowId: string) => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}/steps`);
      if (!response.ok) throw new Error("Failed to fetch steps");
      const data = await response.json();
      setSteps(data.steps || []);
    } catch (error) {
      console.error("Failed to load steps:", error);
      setSteps([]);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, [filter]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "r") {
        e.preventDefault();
        fetchWorkflows();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelectWorkflow = (workflow: WorkflowRun) => {
    setSelectedWorkflow(workflow);
    setActiveTab("overview");
    fetchWorkflowSteps(workflow.id);
  };

  const retryWorkflow = async (workflowId: string) => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}/retry`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to retry workflow");
      fetchWorkflows();
    } catch (error) {
      console.error("Failed to retry workflow:", error);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "success":
        return {
          bg: "bg-green-100 dark:bg-green-950/50",
          text: "text-green-700 dark:text-green-300",
          icon: CheckCircle2Icon,
        };
      case "error":
        return {
          bg: "bg-red-100 dark:bg-red-950/50",
          text: "text-red-700 dark:text-red-300",
          icon: AlertCircle,
        };
      case "running":
        return {
          bg: "bg-blue-100 dark:bg-blue-950/50",
          text: "text-blue-700 dark:text-blue-300",
          icon: Clock,
        };
      default:
        return {
          bg: "bg-slate-100 dark:bg-slate-800",
          text: "text-slate-700 dark:text-slate-300",
          icon: Clock,
        };
    }
  };

  const getStepStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-300";
      case "error":
        return "bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300";
      case "running":
        return "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300";
      case "pending":
        return "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300";
      default:
        return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300";
    }
  };

  const statusLabels: Record<string, string> = {
    draft: "Draft",
    running: "Running",
    success: "Completed",
    error: "Failed",
    pending: "Pending",
    skipped: "Skipped",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <div className="px-6 py-8">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-50">
                  Workflow Monitor
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mt-2">
                  Monitor and manage workflow executions across entities
                </p>
              </div>
              <button
                type="button"
                onClick={fetchWorkflows}
                className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-[#FF8400] hover:border-[#FF8400] transition-all duration-200 font-medium shadow-md hover:shadow-lg"
                title="Refresh (Ctrl+R)"
              >
                <RefreshCwIcon className="h-5 w-5" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6 flex gap-6">
          {/* Left: Workflows List */}
          <div className="w-96 flex-shrink-0">
            {/* Filter Bar */}
            <div className="bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 p-4 mb-4 shadow-sm">
              <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-50 uppercase tracking-wide mb-3">
                Filters
              </h2>
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="index-status"
                    className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5 block"
                  >
                    Status
                  </label>
                  <select
                    id="index-status"
                    className="w-full px-2.5 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[#FF8400] focus:ring-offset-1 dark:focus:ring-offset-slate-950 transition-all"
                    value={filter.status || ""}
                    onChange={(e) => setFilter({ ...filter, status: e.target.value || undefined })}
                  >
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="running">Running</option>
                    <option value="success">Completed</option>
                    <option value="error">Failed</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="index-entity-2"
                    className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5 block"
                  >
                    Entity
                  </label>
                  <select
                    id="index-entity-2"
                    className="w-full px-2.5 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[#FF8400] focus:ring-offset-1 dark:focus:ring-offset-slate-950 transition-all"
                    value={filter.entity || ""}
                    onChange={(e) => setFilter({ ...filter, entity: e.target.value || undefined })}
                  >
                    <option value="">All Entities</option>
                    <option value="Patient">Patient</option>
                    <option value="Appointment">Appointment</option>
                    <option value="Prescription">Prescription</option>
                    <option value="Invoice">Invoice</option>
                    <option value="Ward">Ward</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Workflows List */}
            {loading ? (
              <div className="bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 p-8 text-center shadow-sm">
                <div className="animate-spin inline-block h-6 w-6 border-3 border-[#FF8400] border-t-transparent rounded-full mb-3"></div>
                <p className="text-xs text-slate-600 dark:text-slate-400">Loading workflows...</p>
              </div>
            ) : workflows.length === 0 ? (
              <div className="bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 p-6 text-center shadow-sm">
                <div className="text-3xl mb-2">⚙️</div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  No Workflows
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Workflows will appear as they execute.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
                {workflows.map((workflow) => {
                  const statusColors = getStatusBadgeColor(workflow.status);
                  const StatusIcon = statusColors.icon;

                  return (
                    <button
                      type="button"
                      key={workflow.id}
                      onClick={() => handleSelectWorkflow(workflow)}
                      className={`w-full text-left p-4 rounded-lg border transition-all duration-200 cursor-pointer ${
                        selectedWorkflow?.id === workflow.id
                          ? "border-[#FF8400] bg-orange-50 dark:bg-slate-900/50 shadow-md"
                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-50 truncate">
                            {workflow.operation}
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                            {workflow.entity_name}
                          </p>
                        </div>
                        <div
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${statusColors.bg} ${statusColors.text}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {statusLabels[workflow.status]}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Workflow Details Window (AD-Style Tabbed) */}
          {selectedWorkflow ? (
            <div className="flex-1">
              <div className="bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden flex flex-col h-[calc(100vh-200px)]">
                {/* Window Header + Tabs */}
                <div className="border-b border-slate-200 dark:border-slate-800 p-4 bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-900 dark:to-transparent">
                  <div className="mb-3">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                      {selectedWorkflow.operation}
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {selectedWorkflow.entity_name} • {selectedWorkflow.entity_id}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 mb-3">
                    {selectedWorkflow.status === "error" && (
                      <button
                        type="button"
                        onClick={() => retryWorkflow(selectedWorkflow.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-[#FF8400] rounded-lg text-[#FF8400] text-sm hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-all duration-200 font-medium"
                      >
                        <RotateCwIcon className="h-4 w-4" />
                        Retry
                      </button>
                    )}
                  </div>

                  {/* Tab Navigation (AD-Style) */}
                  <div className="flex gap-1 border-t border-slate-200 dark:border-slate-800 pt-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab("overview")}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-all duration-200 ${
                        activeTab === "overview"
                          ? "border-[#FF8400] text-[#FF8400]"
                          : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50"
                      }`}
                    >
                      Overview
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("steps")}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-all duration-200 ${
                        activeTab === "steps"
                          ? "border-[#FF8400] text-[#FF8400]"
                          : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50"
                      }`}
                    >
                      Steps ({steps.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("logs")}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-all duration-200 ${
                        activeTab === "logs"
                          ? "border-[#FF8400] text-[#FF8400]"
                          : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50"
                      }`}
                    >
                      Logs
                    </button>
                  </div>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  {activeTab === "overview" ? (
                    <div className="space-y-4 max-w-2xl">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">
                            Status
                          </span>
                          <div
                            className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${getStatusBadgeColor(selectedWorkflow.status)}`}
                          >
                            {statusLabels[selectedWorkflow.status]}
                          </div>
                        </div>
                        <div>
                          <label
                            htmlFor="index-entity"
                            className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1"
                          >
                            Entity
                          </label>
                          <input
                            id="index-entity"
                            type="text"
                            defaultValue={selectedWorkflow.entity_name}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-50 text-sm"
                            readOnly
                          />
                        </div>
                      </div>
                      <div>
                        <label
                          htmlFor="index-entity-id"
                          className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1"
                        >
                          Entity ID
                        </label>
                        <input
                          id="index-entity-id"
                          type="text"
                          defaultValue={selectedWorkflow.entity_id}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-50 text-sm font-mono"
                          readOnly
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor="index-started"
                            className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1"
                          >
                            Started
                          </label>
                          <input
                            id="index-started"
                            type="text"
                            defaultValue={new Date(selectedWorkflow.created_at).toLocaleString()}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-50 text-sm"
                            readOnly
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="index-updated"
                            className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1"
                          >
                            Updated
                          </label>
                          <input
                            id="index-updated"
                            type="text"
                            defaultValue={new Date(selectedWorkflow.updated_at).toLocaleString()}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-50 text-sm"
                            readOnly
                          />
                        </div>
                      </div>
                      {selectedWorkflow.retry_count > 0 && (
                        <div>
                          <label
                            htmlFor="index-retries"
                            className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1"
                          >
                            Retries
                          </label>
                          <input
                            id="index-retries"
                            type="text"
                            defaultValue={selectedWorkflow.retry_count}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-50 text-sm"
                            readOnly
                          />
                        </div>
                      )}
                      {selectedWorkflow.error_message && (
                        <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-lg">
                          <div className="flex gap-3">
                            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-red-700 dark:text-red-300">
                              <strong className="block">Error:</strong>
                              {selectedWorkflow.error_message}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : activeTab === "steps" ? (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-4">
                        Workflow Steps
                      </h3>
                      {steps.length === 0 ? (
                        <div className="text-center py-8 text-slate-600 dark:text-slate-400">
                          <p className="text-sm">No steps defined.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {steps.map((step) => (
                            <div
                              key={step.id}
                              className="border border-slate-200 dark:border-slate-800 rounded-lg p-3"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-400 min-w-[20px]">
                                    {step.sequence}
                                  </span>
                                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                                    {step.name}
                                  </span>
                                </div>
                                <span
                                  className={`text-xs font-medium px-2 py-1 rounded ${getStepStatusColor(step.status)}`}
                                >
                                  {statusLabels[step.status] || step.status}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                                  {step.type}
                                </span>
                                {step.duration_ms && (
                                  <span className="text-xs text-slate-600 dark:text-slate-400">
                                    {step.duration_ms}ms
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-4">
                        Execution Logs
                      </h3>
                      <div className="bg-slate-900 dark:bg-black text-slate-100 dark:text-slate-200 p-4 rounded-lg font-mono text-xs max-h-96 overflow-y-auto border border-slate-800">
                        <div className="text-slate-500">
                          [INFO] Workflow started at{" "}
                          {new Date(selectedWorkflow.created_at).toISOString()}
                        </div>
                        <div className="text-slate-500">
                          [INFO] Entity: {selectedWorkflow.entity_name}
                        </div>
                        <div className="text-slate-500">
                          [INFO] Operation: {selectedWorkflow.operation}
                        </div>
                        {selectedWorkflow.status === "error" && (
                          <div className="text-red-400 mt-2">
                            [ERROR] {selectedWorkflow.error_message}
                          </div>
                        )}
                        <div className="text-slate-500 mt-2">
                          [INFO] Workflow completed at{" "}
                          {new Date(selectedWorkflow.updated_at).toISOString()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-slate-600 dark:text-slate-400">
                <p className="text-lg font-medium">Select a workflow to view details</p>
                <p className="text-sm mt-1">Choose a workflow from the list on the left</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
