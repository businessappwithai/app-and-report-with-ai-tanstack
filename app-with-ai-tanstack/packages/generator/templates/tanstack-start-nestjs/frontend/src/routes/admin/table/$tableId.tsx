import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/table/$tableId")({
  component: TableLayout,
});

function TableLayout() {
  return <Outlet />;
}
