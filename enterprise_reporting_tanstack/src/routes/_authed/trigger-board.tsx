import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Mail,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";

export const Route = createFileRoute("/_authed/trigger-board")({
  component: TriggerBoardPage,
});

const TRIGGER_TASKS = [
  {
    id: "report:generate",
    label: "Report Generation",
    description: "Generates CSV, XLSX, and PDF reports",
    icon: FileText,
    color: "text-blue-500",
  },
  {
    id: "data:export",
    label: "Data Export",
    description: "Exports query results to files",
    icon: Activity,
    color: "text-emerald-500",
  },
  {
    id: "email:batch",
    label: "Email Batch",
    description: "Sends batch emails with attachments",
    icon: Mail,
    color: "text-violet-500",
  },
  {
    id: "scheduled:refresh",
    label: "Scheduled Refresh",
    description: "Refreshes reports, charts, and dashboards on schedule",
    icon: Clock,
    color: "text-orange-500",
  },
];

function QueueManagementContent() {
  const { data: jobs = [], isLoading, refetch } = useQuery({
    queryKey: ["job-definitions"],
    queryFn: async () => {
      const res = await fetch("/api/jobs?pageSize=50");
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load jobs`);
      const data = await res.json();
      return data.data?.items || [];
    },
    refetchInterval: 30000,
  });

  const activeJobs = jobs.filter((j: any) => j.is_active && !j.is_deleted);
  const scheduledJobs = activeJobs.filter((j: any) => j.schedule_cron);

  useCopilotReadable({
    description: "Registered Trigger.dev task types available in this application",
    value: TRIGGER_TASKS.map((t) => ({ id: t.id, label: t.label, description: t.description })),
  });

  useCopilotReadable({
    description: "Active scheduled job definitions",
    value: scheduledJobs.map((j: any) => ({
      id: j.id,
      name: j.name,
      type: j.job_type,
      cron: j.schedule_cron,
    })),
  });

  useCopilotAction({
    name: "createScheduledJob",
    description: "Create a new scheduled job definition. Ask the user for the job name, type (report:generate, data:export, email:batch, scheduled:refresh), and cron schedule if not provided.",
    parameters: [
      { name: "name", type: "string", description: "Job name", required: true },
      { name: "jobType", type: "string", description: "Task type ID (e.g. report:generate, email:batch)", required: true },
      { name: "cron", type: "string", description: "Cron schedule expression (e.g. '0 8 * * *' for daily 8am)", required: false },
    ],
    handler: async ({ name, jobType, cron }) => {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, job_type: jobType, schedule_cron: cron || null, is_active: true }),
      });
      if (!res.ok) return `Failed to create job: HTTP ${res.status}`;
      refetch();
      return `Job "${name}" (${jobType}) created${cron ? ` with schedule: ${cron}` : " as on-demand"}.`;
    },
  });

  useCopilotAction({
    name: "explainTriggerTask",
    description: "Explain what a registered Trigger.dev task type does and when to use it",
    parameters: [
      { name: "taskId", type: "string", description: "Task ID (e.g. report:generate)", required: true },
    ],
    handler: async ({ taskId }) => {
      const task = TRIGGER_TASKS.find((t) => t.id === taskId);
      if (!task) return `Unknown task ID: ${taskId}. Available: ${TRIGGER_TASKS.map((t) => t.id).join(", ")}`;
      return `${task.label} (${task.id}): ${task.description}. This task runs in the background via Trigger.dev and can be scheduled with a cron expression or triggered on-demand.`;
    },
  });

  useCopilotAction({
    name: "explainCronSyntax",
    description: "Explain cron schedule syntax and give examples for common patterns like daily, hourly, weekly",
    parameters: [
      { name: "pattern", type: "string", description: "Natural language pattern like 'daily', 'every Monday', 'hourly'", required: false },
    ],
    handler: async ({ pattern }) => {
      const examples: Record<string, string> = {
        daily: "0 8 * * * — every day at 8am",
        hourly: "0 * * * * — every hour at :00",
        weekly: "0 9 * * 1 — every Monday at 9am",
        monthly: "0 0 1 * * — 1st of every month at midnight",
        "every 15 minutes": "*/15 * * * * — every 15 minutes",
      };
      if (pattern && examples[pattern.toLowerCase()]) return examples[pattern.toLowerCase()];
      return `Cron format: [minute] [hour] [day-of-month] [month] [day-of-week]\nExamples:\n${Object.values(examples).join("\n")}`;
    },
  });

  return (
    <CopilotSidebar
      instructions="You are a background job scheduling assistant for Trigger.dev.\nHelp users understand the registered task types, create scheduled jobs, and interpret cron schedules.\nWhen the user describes a job they want, call createScheduledJob with the appropriate task type and cron.\nIf they ask about cron syntax, call explainCronSyntax.\nAvailable task types: report:generate, data:export, email:batch, scheduled:refresh."
      defaultOpen={false}
      labels={{
        title: "Trigger Board Assistant",
        initial: "Ask me to schedule a job, explain a task type, or help with cron syntax.",
        placeholder: "e.g. Schedule a daily report export at 7am…",
      }}
    >
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Trigger Board" description="Background jobs powered by Trigger.dev" />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {process.env.TRIGGER_API_URL && (
            <Button variant="outline" size="sm" asChild>
              <a href={process.env.TRIGGER_API_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Trigger.dev Dashboard
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Registered Tasks */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          Registered Tasks
        </h2>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {TRIGGER_TASKS.map((task) => {
            const Icon = task.icon;
            return (
              <Card key={task.id}>
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className={`rounded-md p-2 bg-muted`}>
                    <Icon className={`h-4 w-4 ${task.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-medium leading-tight">
                      {task.label}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-tremor-label text-tremor-content">{task.description}</p>
                  <div className="mt-2">
                    <Badge variant="secondary" className="text-xs font-mono">
                      {task.id}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Job Definitions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Scheduled Jobs
              </CardTitle>
              <CardDescription>
                Job definitions with recurring schedules ({scheduledJobs.length} active)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading jobs...</div>
          ) : scheduledJobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No scheduled jobs configured. Create one from the Jobs page.
            </div>
          ) : (
            <div className="space-y-2">
              {scheduledJobs.map((job: any) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{job.name}</p>
                      <p className="text-tremor-label text-tremor-content">
                        {job.job_type} · cron:{" "}
                        <span className="font-mono">{job.schedule_cron}</span>
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    active
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Job Definitions */}
      {activeJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Job Definitions</CardTitle>
            <CardDescription>
              {activeJobs.length} active job definition{activeJobs.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeJobs.map((job: any) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium">{job.name}</p>
                    <p className="text-tremor-label text-tremor-content">
                      Type: {job.job_type}
                      {job.schedule_cron ? ` · ${job.schedule_cron}` : " · on-demand"}
                    </p>
                  </div>
                  <Badge variant={job.schedule_cron ? "default" : "secondary"} className="text-xs">
                    {job.schedule_cron ? "scheduled" : "on-demand"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-dashed">
        <CardContent className="py-4">
          <p className="text-xs text-muted-foreground text-center">
            Live run status and logs are available in the{" "}
            <a
              href="https://dashboard.trigger.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Trigger.dev dashboard
            </a>
            . For local development, set <span className="font-mono">TRIGGER_API_URL</span> to your
            Mastra.ai server.
          </p>
        </CardContent>
      </Card>
    </div>
    </CopilotSidebar>
  );
}

function TriggerBoardPage() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <QueueManagementContent />
    </CopilotKit>
  );
}
