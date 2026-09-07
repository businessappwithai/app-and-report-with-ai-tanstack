import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, CheckIcon, ClockIcon, RotateCwIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requestContext } from "@/lib/request-context";

interface WorkflowRunDetail {
  id: string;
  entity_name: string;
  entity_id: string;
  operation: string;
  status: "draft" | "success" | "error";
  error_message?: string;
  error_details?: string;
  retry_count: number;
  triggered_by?: string;
  created_at: string;
  updated_at: string;
}

async function checkAuthMe() {
  const { baseUrl, fetchInit } = await requestContext();
  const res = await fetch(`${baseUrl}/api/auth/me`, fetchInit);
  return res.json() as Promise<{ user: { id: string; email: string; role: string } | null }>;
}

export const Route = createFileRoute("/admin/workflows/$workflowId")({
  beforeLoad: async () => {
    try {
      const data = await checkAuthMe();
      if (!data.user) throw redirect({ to: "/login" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
      throw redirect({ to: "/login" });
    }
  },
  component: WorkflowDetailPage,
});

function WorkflowDetailPage() {
  const navigate = useNavigate();
  const { workflowId } = Route.useParams();

  const [workflow, setWorkflow] = useState<WorkflowRunDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchWorkflow();
  }, [workflowId]);

  const fetchWorkflow = async () => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}`);
      if (!response.ok) throw new Error("Failed to fetch workflow");

      const data = await response.json();
      setWorkflow(data);
    } catch (error) {
      toast.error("Failed to load workflow");
      console.error(error);
    }
  };

  const retryWorkflow = async () => {
    if (!workflow) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/workflows/${workflow.id}/retry`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to retry workflow");

      toast.success("Workflow retry initiated");
      await fetchWorkflow();
    } catch (error) {
      toast.error("Failed to retry workflow");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckIcon className="h-5 w-5 text-green-600" />;
      case "error":
        return <XIcon className="h-5 w-5 text-red-600" />;
      case "draft":
        return <ClockIcon className="h-5 w-5 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "default";
      case "error":
        return "destructive";
      case "draft":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (!workflow) {
    return (
      <div className="container mx-auto py-8">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate({ to: "/admin/workflows" })}
          className="mb-4"
        >
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Back to Workflows
        </Button>
        <h1 className="text-3xl font-bold">Workflow Details</h1>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Workflow Run</CardTitle>
              <CardDescription>ID: {workflow.id}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(workflow.status)}
              <Badge variant={getStatusColor(workflow.status)}>{workflow.status}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <span className="text-sm font-medium text-muted-foreground">Entity</span>
              <p className="text-lg">{workflow.entity_name}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground">Entity ID</span>
              <p className="text-lg font-mono">{workflow.entity_id}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground">Operation</span>
              <p className="text-lg">{workflow.operation}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground">Retry Count</span>
              <p className="text-lg">{workflow.retry_count}</p>
            </div>
            {workflow.triggered_by && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Triggered By</span>
                <p className="text-lg">{workflow.triggered_by}</p>
              </div>
            )}
            <div>
              <span className="text-sm font-medium text-muted-foreground">Created At</span>
              <p className="text-lg">{new Date(workflow.created_at).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground">Updated At</span>
              <p className="text-lg">{new Date(workflow.updated_at).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground">Duration</span>
              <p className="text-lg">
                {Math.round(
                  (new Date(workflow.updated_at).getTime() -
                    new Date(workflow.created_at).getTime()) /
                    1000
                )}{" "}
                seconds
              </p>
            </div>
          </div>

          {workflow.status === "error" && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Error Details</h3>
                <Button onClick={retryWorkflow} disabled={loading} variant="outline">
                  {loading ? "Retrying..." : "Retry"}
                  {!loading && <RotateCwIcon className="ml-2 h-4 w-4" />}
                </Button>
              </div>
              <div className="space-y-3">
                {workflow.error_message && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded">
                    <strong>Message:</strong>
                    <p className="mt-1 text-sm">{workflow.error_message}</p>
                  </div>
                )}
                {workflow.error_details && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded">
                    <strong>Details:</strong>
                    <pre className="mt-1 text-xs overflow-auto">{workflow.error_details}</pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
