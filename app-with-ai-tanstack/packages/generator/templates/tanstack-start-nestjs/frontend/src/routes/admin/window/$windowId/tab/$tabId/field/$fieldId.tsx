import { createFileRoute } from "@tanstack/react-router";
import { ADDetailShell } from "@/components/admin/ad-detail-shell";
import { FIELD_LEVEL, TAB_LEVEL, WINDOW_LEVEL } from "@/components/admin/ad-window-configs";

export const Route = createFileRoute("/admin/window/$windowId/tab/$tabId/field/$fieldId")({
  component: FieldDetailPage,
});

function FieldDetailPage() {
  const { windowId, tabId, fieldId } = Route.useParams();
  return (
    <ADDetailShell
      level={FIELD_LEVEL}
      recordId={fieldId}
      parentContext={[
        { level: WINDOW_LEVEL, id: windowId },
        { level: TAB_LEVEL, id: tabId },
      ]}
    />
  );
}
