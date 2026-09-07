import { createFileRoute } from "@tanstack/react-router";
import { ADListShell } from "@/components/admin/ad-list-shell";
import { TAB_LEVEL, WINDOW_LEVEL } from "@/components/admin/ad-window-configs";

export const Route = createFileRoute("/admin/window/$windowId/tabs")({
  component: WindowTabsListPage,
});

function WindowTabsListPage() {
  const { windowId } = Route.useParams();
  return <ADListShell level={TAB_LEVEL} parentContext={[{ level: WINDOW_LEVEL, id: windowId }]} />;
}
