import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { BarChart3, Home, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const getPublicChartFn = createServerFn({ method: "GET" })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { getDb } = await import("@/lib/db/config");
    const db = getDb();
    const chart = await db
      .selectFrom("chart_definitions")
      .where("id", id)
      .where("is_public", true)
      .selectAll()
      .executeTakeFirst();
    if (!chart) return null;
    return chart;
  });

export const Route = createFileRoute("/share/chart/$id")({
  loader: ({ params }) => getPublicChartFn({ data: params.id }),
  component: PublicChartPage,
});

function PublicChartPage() {
  const chart = Route.useLoaderData();

  if (!chart) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Lock className="h-12 w-12 text-muted-foreground" />
            </div>
            <CardTitle>Chart Not Available</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-tremor-content">
              This chart is not publicly accessible or does not exist.
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
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">{chart.name}</h1>
            {chart.description && (
              <p className="text-tremor-default text-tremor-content">{chart.description}</p>
            )}
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center py-8">
              Chart visualization for: {chart.name}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
