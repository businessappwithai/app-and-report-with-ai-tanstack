import { createFileRoute } from "@tanstack/react-router";
import { LogsViewer } from "@/components/logs/logs-viewer";
import { PageHeader } from "@/components/layout/page-header";

export const Route = createFileRoute("/_authed/logs")({
  component: LogsPage,
});

function LogsPage() {
  return (
    <div className="p-6">
      <PageHeader
        className="mb-6"
        title="System Logs"
        description="View system logs and debugging information"
      />
      <LogsViewer />
    </div>
  );
}
