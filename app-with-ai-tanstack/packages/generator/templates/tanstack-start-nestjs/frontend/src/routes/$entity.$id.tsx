import { createFileRoute } from "@tanstack/react-router";
import { BusEntityDetailPage } from "@/components/admin/bus-entity-detail-page";

export const Route = createFileRoute("/$entity/$id")({
  component: DynamicEntityDetailPage,
});

function DynamicEntityDetailPage() {
  const { entity, id } = Route.useParams();
  const normalized = entity.toLowerCase().replace(/-/g, "_");
  const entityName = normalized.startsWith("bus_") ? normalized.slice(4) : normalized;
  return <BusEntityDetailPage entityName={entityName} recordId={id} />;
}
