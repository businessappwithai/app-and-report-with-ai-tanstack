import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle,
  Clock,
  Download,
  MoreHorizontal,
  Pause,
  RefreshCw,
  Trash,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/utils";
import type { JobDefinition, JobExecution } from "@/types/database";
import { PageHeader } from "@/components/layout/page-header";

import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";
export const Route = createFileRoute("/_authed/jobs/")({
  component: JobsPage,
});

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  running: <RefreshCw className="h-4 w-4 animate-spin" />,
  completed: <CheckCircle className="h-4 w-4" />,
  failed: <XCircle className="h-4 w-4" />,
  cancelled: <Pause className="h-4 w-4" />,
};

function JobsContent() {
  const queryClient = useQueryClient();

  const { data: queueStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["queue-status"],
    queryFn: async () => {
      const res = await fetch("/api/jobs/status");
      const data = await res.json();
      return data.data;
    },
    refetchInterval: 5000,
  });

  const { data: jobDefinitions, isLoading: isLoadingDefinitions } = useQuery<JobDefinition[]>({
    queryKey: ["job-definitions"],
    queryFn: async () => {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      return data.data?.items || [];
    },
  });

  const { data: recentExecutions, isLoading: isLoadingExecutions } = useQuery<JobExecution[]>({
    queryKey: ["job-executions"],
    queryFn: async () => {
      const res = await fetch("/api/jobs/executions?limit=20");
      const data = await res.json();
      return data.data?.items || [];
    },
    refetchInterval: 10000,
  });

  const cancelMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Job cancelled");
        queryClient.invalidateQueries({ queryKey: ["job-executions"] });
      } else {
        toast.error(data.error?.message || "Failed to cancel job");
      }
    },
  });


  // ── CopilotKit ─────────────────────────────────────────────────────────
  useCopilotReadable({
    description: "Current background job definitions",
    value: (jobDefinitions ?? []).map((j) => ({ id: j.id, name: j.name, type: j.job_type, schedule: j.schedule_cron, isActive: j.is_active })),
  });
  useCopilotReadable({
    description: "Recent job executions",
    value: (recentExecutions ?? []).slice(0, 5).map((e) => ({ jobId: e.job_definition_id, status: e.status, startedAt: e.started_at })),
  });
  useCopilotReadable({
    description: "Queue status (pending/active/completed/failed job counts)",
    value: queueStatus,
  });

  useCopilotAction({
    name: "createJobFromNL",
    description: "Create a new background job from a natural language description. Supports report export and email delivery jobs.",
    parameters: [
      { name: "jobName", type: "string", description: "Job name", required: true },
      { name: "jobType", type: "string", description: "Job type: report_export, email_delivery, data_sync, or monitoring", required: true },
      { name: "cronExpression", type: "string", description: "Cron expression (e.g. 0 8 * * 1 for every Monday at 8am)", required: true },
      { name: "description", type: "string", description: "What this job does", required: false },
    ],
    handler: async ({ jobName, jobType, cronExpression, description }) => {
      try {
        const res = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: jobName, description, jobType, scheduleCron: cronExpression }),
        });
        const data = await res.json();
        if (data.success) {
          queryClient.invalidateQueries({ queryKey: ["job-definitions"] });
          return `Job "${jobName}" created with schedule "${cronExpression}".`;
        }
        return `Failed to create job: ${data.error?.message || "Unknown error"}`;
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });
  useCopilotAction({
    name: "explainCron",
    description: "Explain a cron expression in plain English or convert a schedule description to cron syntax",
    parameters: [
      { name: "schedule", type: "string", description: "Either a cron expression or a plain English schedule like 'every Monday at 8am'", required: true },
    ],
    handler: async ({ schedule }) => {
      return `Schedule interpretation for: ${schedule}. Common cron patterns: daily at 8am = "0 8 * * *", every Monday = "0 8 * * 1", hourly = "0 * * * *", every 15min = "*/15 * * * *".`;
    },
  });
  // ────────────────────────────────────────────────────────────────────────

  return (
    <CopilotSidebar
      instructions='You are a background job scheduling assistant.\nHelp users create and understand background jobs.\nWORKFLOW:\n1. When user describes a job, ask: what should it do? how often?\n2. Convert their schedule description to a cron expression.\n3. Call createJobFromNL to create the job.\n4. Use explainCron to explain cron syntax when asked.\nCommon job types: report_export (generates and emails reports), monitoring (checks metric thresholds).'
      defaultOpen={false}
      labels={{
        title: "Job Scheduler AI",
        initial: "Describe the job you want to schedule and I\'ll help configure it.",
        placeholder: "e.g. Email a sales report every Monday at 8am…",
      }}
    >
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Background Jobs" description="Monitor and manage background job processing" />
        <Button variant="outline" onClick={() => refetchStatus()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-tremor-default font-medium text-tremor-content">Waiting</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="font-semibold text-tremor-metric text-tremor-content-strong">{queueStatus?.waiting || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-tremor-default font-medium text-tremor-content">Active</CardTitle>
            <RefreshCw className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="font-semibold text-tremor-metric text-tremor-content-strong">{queueStatus?.active || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-tremor-default font-medium text-tremor-content">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="font-semibold text-tremor-metric text-tremor-content-strong">{queueStatus?.completed || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-tremor-default font-medium text-tremor-content">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="font-semibold text-tremor-metric text-tremor-content-strong">{queueStatus?.failed || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-tremor-default font-medium text-tremor-content">Delayed</CardTitle>
            <Pause className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="font-semibold text-tremor-metric text-tremor-content-strong">{queueStatus?.delayed || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="executions">
        <TabsList>
          <TabsTrigger value="executions">Recent Executions</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled Jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="executions">
          <Card>
            <CardHeader>
              <CardTitle>Recent Job Executions</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingExecutions ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : recentExecutions?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No job executions yet</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentExecutions?.map((execution) => (
                      <TableRow key={execution.id}>
                        <TableCell className="font-mono text-sm">
                          {execution.id.substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                            {statusIcons[execution.status]}
                            {execution.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-tremor-content">
                          {execution.started_at ? formatDateTime(execution.started_at) : "-"}
                        </TableCell>
                        <TableCell className="text-tremor-content">
                          {execution.completed_at ? formatDateTime(execution.completed_at) : "-"}
                        </TableCell>
                        <TableCell>
                          {execution.execution_metadata
                            ? `${JSON.parse(execution.execution_metadata).duration}ms`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {execution.result_location && (
                                <DropdownMenuItem asChild>
                                  <a href={`/api/jobs/${execution.id}/result`} download>
                                    <Download className="h-4 w-4 mr-2" />
                                    Download Result
                                  </a>
                                </DropdownMenuItem>
                              )}
                              {(execution.status === "pending" ||
                                execution.status === "running") && (
                                <DropdownMenuItem
                                  onClick={() => cancelMutation.mutate(execution.id)}
                                  className="text-destructive"
                                >
                                  <Trash className="h-4 w-4 mr-2" />
                                  Cancel
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduled">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingDefinitions ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : jobDefinitions?.filter((j) => j.schedule_cron).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No scheduled jobs configured
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobDefinitions
                      ?.filter((j) => j.schedule_cron)
                      .map((job) => (
                        <TableRow key={job.id}>
                          <TableCell className="font-medium">{job.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{job.job_type}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{job.schedule_cron}</TableCell>
                          <TableCell>
                            <Badge variant={job.is_active ? "default" : "secondary"}>
                              {job.is_active ? "Active" : "Paused"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </CopilotSidebar>
  );
}


function JobsPage() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <JobsContent />
    </CopilotKit>
  );
}
