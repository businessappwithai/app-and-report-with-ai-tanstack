/**
 * Admin layout.
 *
 * Also where the model assistant lives. Mounted here rather than on individual
 * admin pages so it is present across all of them, and behind the same role
 * check as the rest of this section: the model describes the whole
 * application's data design, including entities a given user may have no
 * access to.
 *
 */

import { CopilotKit } from '@copilotkit/react-core';
import { CopilotSidebar } from '@copilotkit/react-ui';
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { useModelAssistant } from '../hooks/useModelAssistant';
import '@copilotkit/react-ui/styles.css';
import { APP_NAME } from "@/lib/app-meta";

export const Route = createFileRoute('/admin')({
  // Redirect non-admin users before the component tree renders
  beforeLoad: ({ context }: any) => {
    const role = (context as any)?.user?.role;
    if (role && role !== 'admin') {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: AdminLayout,
});

/**
 * The hook has to run below CopilotKit's provider — calling it in AdminLayout
 * itself would place the context below its own consumer and throw.
 */
function AdminContent() {
  useModelAssistant();
  return <Outlet />;
}

/**
 * Hoisted out of the JSX deliberately.
 *
 * Inline, an object prop opens with a doubled brace — one for the JSX
 * expression and one for the object — which is also how a Handlebars
 * expression opens. This file is a Handlebars template, so writing it that way
 * fails to compile and the route is skipped at generation time with only a
 * warning. Naming the object avoids the collision entirely.
 */
const ASSISTANT_LABELS = {
  title: `${APP_NAME} assistant`,
  initial:
    "I can search this application's model — its entities and fields, the business " +
    'rules that run on them, and the processes that create, update and delete records. ' +
    'Ask what already happens on an entity, or describe a change and I will tell you ' +
    'what it would affect.',
};

function AdminLayout() {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      // The inspector is gated on `enableInspector`, NOT `showDevConsole` —
      // the <CopilotKit> wrapper reads them from different props, and
      // `showDevConsole` only silences error toasts and banners. Left unset,
      // `enableInspector` falls back to "is this localhost?", so it mounts a
      // <cpk-web-inspector> floating button above everything at z-index
      // 2147483646 that swallows clicks landing under it — including from any
      // script driving the UI. Off unless someone asks for it.
      enableInspector={false}
      showDevConsole={false}
    >
      <AdminContent />
      <CopilotSidebar
        labels={ASSISTANT_LABELS}
        defaultOpen={false}
        clickOutsideToClose={false}
      />
    </CopilotKit>
  );
}
