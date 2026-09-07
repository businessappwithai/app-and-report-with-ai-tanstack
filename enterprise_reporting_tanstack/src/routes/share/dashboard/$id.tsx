import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Home, LayoutDashboard, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const getPublicDashboardFn = createServerFn({ method: "GET" })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { getDb } = await import("@/lib/db/config");
    const db = getDb();
    const dashboard = await db
      .selectFrom("dashboard_layouts")
      .where("id", id)
      .where("is_public", true)
      .selectAll()
      .executeTakeFirst();
    if (!dashboard) return null;
    return dashboard;
  });

export const Route = createFileRoute("/share/dashboard/$id")({
  loader: ({ params }) => getPublicDashboardFn({ data: params.id }),
  component: PublicDashboardPage,
});

function PublicDashboardPage() {
  const dashboard = Route.useLoaderData();

  if (!dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Lock className="h-12 w-12 text-muted-foreground" />
            </div>
            <CardTitle>Dashboard Not Available</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-tremor-content">
              This dashboard is not publicly accessible or does not exist.
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
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">{dashboard.name}</h1>
            {dashboard.description && (
              <p className="text-tremor-default text-tremor-content">{dashboard.description}</p>
            )}
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center py-8">Dashboard: {dashboard.name}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
