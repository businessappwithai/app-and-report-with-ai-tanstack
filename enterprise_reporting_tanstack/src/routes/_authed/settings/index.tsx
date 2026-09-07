import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Bell, Database, Mail, Palette, SwatchBook, Users as UsersIcon } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

export const Route = createFileRoute("/_authed/settings/")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/email" });
  },
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your application settings" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
          <Link to="/settings/email">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                <CardTitle>Email Settings</CardTitle>
              </div>
              <CardDescription>Configure email server settings for notifications</CardDescription>
            </CardHeader>
          </Link>
        </Card>

        <Card className="opacity-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <CardTitle>Data Sources</CardTitle>
            </div>
            <CardDescription>Manage database connections (Coming Soon)</CardDescription>
          </CardHeader>
        </Card>

        <Card className="opacity-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <CardTitle>Notifications</CardTitle>
            </div>
            <CardDescription>Configure notification preferences (Coming Soon)</CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover:bg-tremor-background-muted transition-colors cursor-pointer">
          <Link to="/settings/ui">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                <CardTitle>UI Settings</CardTitle>
              </div>
              <CardDescription>Configure table display and appearance</CardDescription>
            </CardHeader>
          </Link>
        </Card>

        <Card className="hover:bg-tremor-background-muted transition-colors cursor-pointer">
          <Link to="/settings/design-system">
            <CardHeader>
              <div className="flex items-center gap-2">
                <SwatchBook className="h-5 w-5" />
                <CardTitle>Design System</CardTitle>
              </div>
              <CardDescription>
                Tremor tokens and components as they render in this application
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>

        <Card className="opacity-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5" />
              <CardTitle>Account</CardTitle>
            </div>
            <CardDescription>Manage your account settings (Coming Soon)</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
