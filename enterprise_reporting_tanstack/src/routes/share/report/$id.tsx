import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { FileText, Home, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const getPublicReportFn = createServerFn({ method: "GET" })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { getDb } = await import("@/lib/db/config");
    const db = getDb();
    const report = await db
      .selectFrom("report_definitions")
      .where("id", id)
      .where("is_public", true)
      .selectAll()
      .executeTakeFirst();
    if (!report) return null;
    return report;
  });

export const Route = createFileRoute("/share/report/$id")({
  loader: ({ params }) => getPublicReportFn({ data: params.id }),
  component: PublicReportPage,
});

function PublicReportPage() {
  const report = Route.useLoaderData();

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Lock className="h-12 w-12 text-muted-foreground" />
            </div>
            <CardTitle>Report Not Available</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-tremor-content">
              This report is not publicly accessible or does not exist.
            </p>
            <Link to="/">
              <Button variant="outline">
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">{report.name}</h1>
            {report.description && (
              <p className="text-tremor-default text-tremor-content">{report.description}</p>
            )}
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center py-8">Report: {report.name}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
