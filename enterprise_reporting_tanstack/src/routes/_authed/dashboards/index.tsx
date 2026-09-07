import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Edit, Eye, Globe, LayoutDashboard, Lock, MoreHorizontal, Plus, Trash } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCanCreate, useCanDelete, useCanEdit } from "@/lib/hooks/usePermissions";
import { formatDateTime } from "@/lib/utils";
import type { DashboardLayout } from "@/types/database";
import { PageHeader } from "@/components/layout/page-header";

export const Route = createFileRoute("/_authed/dashboards/")({
  component: DashboardsPage,
});

function DashboardsPage() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState("");
  const [newDashboardDescription, setNewDashboardDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [editingDashboard, setEditingDashboard] = useState<DashboardLayout | null>(null);

  const canCreateDashboard = useCanCreate("dashboard");
  const canEditDashboards = useCanEdit("dashboard");
  const canDeleteDashboards = useCanDelete("dashboard");

  const { data: dashboards, isLoading } = useQuery<DashboardLayout[]>({
    queryKey: ["dashboards"],
    queryFn: async () => {
      const res = await fetch("/api/dashboards");
      const data = await res.json();
      return data.data?.items || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/dashboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newDashboardName,
          description: newDashboardDescription,
          isPublic,
          layoutConfig: {
            cols: { lg: 12, md: 10, sm: 6, xs: 4 },
            rowHeight: 100,
            containerPadding: [10, 10],
            margin: [10, 10],
            layouts: { lg: [], md: [], sm: [], xs: [] },
          },
        }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Dashboard created successfully");
        queryClient.invalidateQueries({ queryKey: ["dashboards"] });
        setCreateDialogOpen(false);
        setNewDashboardName("");
        setNewDashboardDescription("");
        setIsPublic(false);
      } else {
        toast.error(data.error?.message || "Failed to create dashboard");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingDashboard) return;
      const res = await fetch(`/api/dashboards/${editingDashboard.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newDashboardName,
          description: newDashboardDescription,
          isPublic,
        }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.success) {
        toast.success("Dashboard updated successfully");
        queryClient.invalidateQueries({ queryKey: ["dashboards"] });
        setEditDialogOpen(false);
        setEditingDashboard(null);
        setNewDashboardName("");
        setNewDashboardDescription("");
        setIsPublic(false);
      } else {
        toast.error(data?.error?.message || "Failed to update dashboard");
      }
    },
  });

  const openEditDialog = (dashboard: DashboardLayout) => {
    setEditingDashboard(dashboard);
    setNewDashboardName(dashboard.name);
    setNewDashboardDescription(dashboard.description || "");
    setIsPublic(dashboard.is_public);
    setEditDialogOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/dashboards/${id}`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Dashboard deleted successfully");
        queryClient.invalidateQueries({ queryKey: ["dashboards"] });
      } else {
        toast.error(data.error?.message || "Failed to delete dashboard");
      }
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Dashboards" description="Create and manage interactive dashboards" />

        {canCreateDashboard && (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Dashboard
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Dashboard</DialogTitle>
                <DialogDescription>
                  Create a new dashboard to organize your reports and charts.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={newDashboardName}
                    onChange={(e) => setNewDashboardName(e.target.value)}
                    placeholder="My Dashboard"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={newDashboardDescription}
                    onChange={(e) => setNewDashboardDescription(e.target.value)}
                    placeholder="Optional description"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="public" checked={isPublic} onCheckedChange={setIsPublic} />
                  <Label htmlFor="public">Make dashboard public</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={!newDashboardName || createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create Dashboard"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Dashboard</DialogTitle>
              <DialogDescription>Update the dashboard details.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={newDashboardName}
                  onChange={(e) => setNewDashboardName(e.target.value)}
                  placeholder="My Dashboard"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={newDashboardDescription}
                  onChange={(e) => setNewDashboardDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="edit-public" checked={isPublic} onCheckedChange={setIsPublic} />
                <Label htmlFor="edit-public">Make dashboard public</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={!newDashboardName || updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5" />
            All Dashboards
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading dashboards...</div>
          ) : dashboards?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No dashboards created yet. Create your first dashboard to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Modified</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboards?.map((dashboard) => (
                  <TableRow key={dashboard.id}>
                    <TableCell className="font-medium">{dashboard.name}</TableCell>
                    <TableCell className="text-tremor-content">
                      {dashboard.description || "-"}
                    </TableCell>
                    <TableCell>
                      {dashboard.is_public ? (
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                          <Globe className="h-3 w-3" />
                          Public
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <Lock className="h-3 w-3" />
                          Private
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-tremor-content">
                      {formatDateTime(dashboard.created_at)}
                    </TableCell>
                    <TableCell className="text-tremor-content">
                      {formatDateTime(dashboard.updated_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to="/dashboards/$id" params={{ id: dashboard.id }}>
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Link>
                          </DropdownMenuItem>
                          {canEditDashboards && (
                            <DropdownMenuItem onClick={() => openEditDialog(dashboard)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Details
                            </DropdownMenuItem>
                          )}
                          {canDeleteDashboards && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteMutation.mutate(dashboard.id)}
                            >
                              <Trash className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
