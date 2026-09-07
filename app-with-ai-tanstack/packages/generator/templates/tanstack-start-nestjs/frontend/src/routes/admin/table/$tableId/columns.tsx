import { createFileRoute } from "@tanstack/react-router";
import { ADListShell } from "@/components/admin/ad-list-shell";
import { COLUMN_LEVEL, TABLE_LEVEL } from "@/components/admin/ad-window-configs";

export const Route = createFileRoute("/admin/table/$tableId/columns")({
  component: TableColumnsListPage,
});

function TableColumnsListPage() {
  const { tableId } = Route.useParams();
  return <ADListShell level={COLUMN_LEVEL} parentContext={[{ level: TABLE_LEVEL, id: tableId }]} />;
}
