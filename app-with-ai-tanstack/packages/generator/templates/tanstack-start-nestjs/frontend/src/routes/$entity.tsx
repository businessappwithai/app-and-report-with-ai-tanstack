import { createFileRoute, Outlet, useChildMatches } from "@tanstack/react-router";
import { BusEntityPage } from "@/components/admin/bus-entity-page";

export const Route = createFileRoute("/$entity")({
  component: DynamicEntityListPage,
});

function DynamicEntityListPage() {
  const { entity } = Route.useParams();
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;
  const normalized = entity.toLowerCase().replace(/-/g, "_");
  const entityName = normalized.startsWith("bus_") ? normalized.slice(4) : normalized;
  return <BusEntityPage entityName={entityName} />;
}
