import { createFileRoute } from "@tanstack/react-router";
import { ADDetailShell } from "@/components/admin/ad-detail-shell";
import { ELEMENT_LEVEL } from "@/components/admin/ad-window-configs";

export const Route = createFileRoute("/admin/element/$elementId")({
  component: ElementDetailPage,
});

function ElementDetailPage() {
  const { elementId } = Route.useParams();
  return <ADDetailShell level={ELEMENT_LEVEL} recordId={elementId} parentContext={[]} />;
}
