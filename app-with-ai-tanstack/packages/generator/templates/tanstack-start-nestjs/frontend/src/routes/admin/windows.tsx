import { createFileRoute } from "@tanstack/react-router";
import { ADListShell } from "@/components/admin/ad-list-shell";
import { WINDOW_LEVEL } from "@/components/admin/ad-window-configs";

export const Route = createFileRoute("/admin/windows")({
  component: WindowsListPage,
});

function WindowsListPage() {
  return <ADListShell level={WINDOW_LEVEL} parentContext={[]} showAdminCrumb />;
}
