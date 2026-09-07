import { createFileRoute } from "@tanstack/react-router";
import { ADListShell } from "@/components/admin/ad-list-shell";
import { ELEMENT_LEVEL } from "@/components/admin/ad-window-configs";

export const Route = createFileRoute("/admin/elements")({
  component: ElementsListPage,
});

function ElementsListPage() {
  return <ADListShell level={ELEMENT_LEVEL} parentContext={[]} showAdminCrumb />;
}
