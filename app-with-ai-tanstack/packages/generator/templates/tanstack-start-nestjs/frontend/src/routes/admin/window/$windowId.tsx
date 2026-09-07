import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/window/$windowId")({
  component: WindowLayout,
});

function WindowLayout() {
  return <Outlet />;
}
