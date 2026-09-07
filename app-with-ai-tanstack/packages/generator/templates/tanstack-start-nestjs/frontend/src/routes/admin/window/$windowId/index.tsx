import { createFileRoute } from "@tanstack/react-router";
import { ADDetailShell } from "@/components/admin/ad-detail-shell";
import { WINDOW_LEVEL } from "@/components/admin/ad-window-configs";

export const Route = createFileRoute("/admin/window/$windowId/")({
  component: WindowDetailPage,
});

function WindowDetailPage() {
  const { windowId } = Route.useParams();
  return <ADDetailShell level={WINDOW_LEVEL} recordId={windowId} parentContext={[]} />;
}
