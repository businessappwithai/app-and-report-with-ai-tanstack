import { createFileRoute } from "@tanstack/react-router";
import { ADDetailShell } from "@/components/admin/ad-detail-shell";
import { REFERENCE_LEVEL } from "@/components/admin/ad-window-configs";

export const Route = createFileRoute("/admin/reference/$referenceId")({
  component: ReferenceDetailPage,
});

function ReferenceDetailPage() {
  const { referenceId } = Route.useParams();
  return <ADDetailShell level={REFERENCE_LEVEL} recordId={referenceId} parentContext={[]} />;
}
