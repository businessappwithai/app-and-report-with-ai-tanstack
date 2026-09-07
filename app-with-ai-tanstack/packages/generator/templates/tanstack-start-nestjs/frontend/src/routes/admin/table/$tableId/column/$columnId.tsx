import { createFileRoute } from "@tanstack/react-router";
import { ADDetailShell } from "@/components/admin/ad-detail-shell";
import { COLUMN_LEVEL, TABLE_LEVEL } from "@/components/admin/ad-window-configs";

export const Route = createFileRoute("/admin/table/$tableId/column/$columnId")({
  component: ColumnDetailPage,
});

function ColumnDetailPage() {
  const { tableId, columnId } = Route.useParams();
  return (
    <ADDetailShell
      level={COLUMN_LEVEL}
      recordId={columnId}
      parentContext={[{ level: TABLE_LEVEL, id: tableId }]}
    />
  );
}
