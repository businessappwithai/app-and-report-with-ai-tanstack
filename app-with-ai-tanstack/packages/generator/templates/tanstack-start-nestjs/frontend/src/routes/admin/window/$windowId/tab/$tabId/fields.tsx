import { createFileRoute } from "@tanstack/react-router";
import { ADListShell } from "@/components/admin/ad-list-shell";
import { FIELD_LEVEL, TAB_LEVEL, WINDOW_LEVEL } from "@/components/admin/ad-window-configs";

export const Route = createFileRoute("/admin/window/$windowId/tab/$tabId/fields")({
  component: TabFieldsListPage,
});

function TabFieldsListPage() {
  const { windowId, tabId } = Route.useParams();
  return (
    <ADListShell
      level={FIELD_LEVEL}
      parentContext={[
        { level: WINDOW_LEVEL, id: windowId },
        { level: TAB_LEVEL, id: tabId },
      ]}
    />
  );
}
