import { Skeleton } from "@/components/ui/skeleton";
import { useBusEntityLevel } from "@/hooks/use-bus-entity-level";
import { ADListShell } from "./ad-list-shell";

interface BusEntityPageProps {
  entityName: string;
}

/**
 * Metadata-driven list page for any bus_ entity.
 * Reads the ADLevel (fields, labels, endpoint) entirely from the Application Dictionary.
 *
 * Generated route files import this and pass entityName — if you need a fully
 * custom window for a specific entity, replace the component body in the route
 * file instead of modifying this shared component.
 */
export function BusEntityPage({ entityName }: BusEntityPageProps) {
  const { level, isLoading } = useBusEntityLevel(entityName);

  if (isLoading || !level) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
      </div>
    );
  }

  return <ADListShell level={level} parentContext={[]} />;
}
