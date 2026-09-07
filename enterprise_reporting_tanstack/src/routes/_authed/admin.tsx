import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

export const Route = createFileRoute("/_authed/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Admin Panel" description="Manage system users, roles, and permissions" />

      <div className="flex flex-wrap gap-4">
        <Link
          to="/admin/users"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Users
        </Link>
        <Link
          to="/admin/roles"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Roles
        </Link>
        <Link
          to="/admin/permissions"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Permissions
        </Link>
        <Link
          to="/admin/schema-instructions"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Schema Instructions
        </Link>
        <Link
          to="/admin/report-builder"
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          NL Report Builder
        </Link>
      </div>

      <Outlet />
    </div>
  );
}
