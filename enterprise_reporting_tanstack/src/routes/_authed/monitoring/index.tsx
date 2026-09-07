import { createFileRoute, Link } from "@tanstack/react-router";
import { MonitoringRuleList } from "@/components/monitoring/MonitoringRuleList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

export const Route = createFileRoute("/_authed/monitoring/")({
  component: MonitoringPage,
});

function MonitoringPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Monitoring Rules" description="Automated threshold monitoring with intelligent alerts" />
        <Link to="/monitoring/create">
          <Button>+ New Monitor</Button>
        </Link>
      </div>

      <Card>
        <CardHeader />
        <CardContent className="pt-0">
          <MonitoringRuleList />
        </CardContent>
      </Card>
    </div>
  );
}
