import { createFileRoute } from "@tanstack/react-router";
import { ADListShell } from "@/components/admin/ad-list-shell";
import { REFERENCE_LEVEL } from "@/components/admin/ad-window-configs";

export const Route = createFileRoute("/admin/references")({
  component: ReferencesListPage,
});

function ReferencesListPage() {
  return <ADListShell level={REFERENCE_LEVEL} parentContext={[]} showAdminCrumb viewOnly />;
}
