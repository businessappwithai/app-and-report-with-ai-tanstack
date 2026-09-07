import { Skeleton } from "@/components/ui/skeleton";
import { useBusEntityLevel } from "@/hooks/use-bus-entity-level";
import { ADDetailShell } from "./ad-detail-shell";

interface BusEntityDetailPageProps {
  entityName: string;
  recordId: string;
}

/**
 * Metadata-driven detail/edit page for any bus_ entity record.
 * Reads the ADLevel (fields, labels, endpoint) entirely from the Application Dictionary.
 *
 * Generated route files import this and pass entityName + recordId — if you need
 * a fully custom window for a specific entity, replace the component body in the
 * route file instead of modifying this shared component.
 */
export function BusEntityDetailPage({ entityName, recordId }: BusEntityDetailPageProps) {
  const { level, isLoading } = useBusEntityLevel(entityName);

  if (isLoading || !level) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-6 w-full" />
      </div>
    );
  }

  return <ADDetailShell level={level} recordId={recordId} parentContext={[]} initialMode="view" />;
}
