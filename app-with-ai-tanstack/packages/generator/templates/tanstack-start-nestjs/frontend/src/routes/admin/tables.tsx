import { createFileRoute } from "@tanstack/react-router";
import { ADListShell } from "@/components/admin/ad-list-shell";
import { TABLE_LEVEL } from "@/components/admin/ad-window-configs";

export const Route = createFileRoute("/admin/tables")({
  component: TablesListPage,
});

function TablesListPage() {
  return <ADListShell level={TABLE_LEVEL} parentContext={[]} showAdminCrumb />;
}
