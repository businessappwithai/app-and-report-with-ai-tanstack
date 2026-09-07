import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { NLMonitoringCreator } from "@/components/monitoring/NLMonitoringCreator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authed/monitoring/create")({
  component: CreateMonitoringPage,
});

function CreateMonitoringPage() {
  const navigate = useNavigate();

  function handleSuccess(result: { ruleId: string; nextRunAt?: string }) {
    toast.success("Monitoring rule created successfully!");
    navigate({ to: "/monitoring" });
  }

  function handleCancel() {
    navigate({ to: "/monitoring" });
  }

  return (
    <div className="container mx-auto py-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="font-semibold text-2xl text-tremor-content-strong">
          Create Monitoring Rule
        </h1>
        <p className="text-tremor-content">
          Use natural language to define what you want to monitor and when to alert.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">New Monitoring Rule</CardTitle>
        </CardHeader>
        <CardContent>
          <NLMonitoringCreator onSuccess={handleSuccess} onCancel={handleCancel} />
        </CardContent>
      </Card>
    </div>
  );
}
