import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Edit, Shield, ShieldPlus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapse } from "@/components/ui/collapse";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Role } from "@/types/database";
import { PageHeader } from "@/components/layout/page-header";

interface ResourcePermission {
  id: string;
  role_id: string;
  resource_type: string;
  resource_id: string;
  permission_level: "view" | "edit" | "admin" | "delete";
}

interface Resource {
  id: string;
  title: string;
  type: string;
}

const _PERMISSION_OPTIONS = [
  { value: "data_source:view", label: "Data Sources - View" },
  { value: "data_source:*", label: "Data Sources - Full Access" },
  { value: "query:view", label: "Queries - View" },
  { value: "query:*", label: "Queries - Full Access" },
  { value: "report:view", label: "Reports - View All" },
  { value: "report:edit", label: "Reports - Edit All" },
  { value: "report:*", label: "Reports - Full Access" },
  { value: "chart:view", label: "Charts - View All" },
  { value: "chart:edit", label: "Charts - Edit All" },
  { value: "chart:*", label: "Charts - Full Access" },
  { value: "dashboard:view", label: "Dashboards - View All" },
  { value: "dashboard:edit", label: "Dashboards - Edit All" },
  { value: "dashboard:*", label: "Dashboards - Full Access" },
  { value: "job:view", label: "Jobs - View" },
  { value: "job:execute", label: "Jobs - Execute" },
  { value: "job:*", label: "Jobs - Full Access" },
  { value: "user:*", label: "Users - Full Access (Admin)" },
];

const PERMISSION_CATEGORIES = {
  "Data Sources": ["data_source:view", "data_source:*"],
  Queries: ["query:view", "query:*"],
  Reports: ["report:view", "report:edit", "report:*"],
  Charts: ["chart:view", "chart:edit", "chart:*"],
  Dashboards: ["dashboard:view", "dashboard:edit", "dashboard:*"],
  Jobs: ["job:view", "job:execute", "job:*"],
  Administration: ["user:*"],
};

const _PERMISSION_LEVELS = [
  { value: "view", label: "View" },
  { value: "edit", label: "Edit" },
  { value: "admin", label: "Admin" },
  { value: "delete", label: "Delete" },
];

export const Route = createFileRoute("/_authed/admin/roles/")({
  component: RolesManagementPage,
});

function RolesManagementPage() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [resourcePermissions, setResourcePermissions] = useState<ResourcePermission[]>([]);

  // Fetch roles
  const { data: roles, isLoading } = useQuery<Role[]>({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await fetch("/api/admin/roles");
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load roles`);
      const data = await res.json();
      return data.data || [];
    },
  });

  // Fetch resources and permissions for selected role
  const { data: resourcesData } = useQuery({
    queryKey: ["role-resources", selectedRole?.id],
    queryFn: async () => {
      if (!selectedRole) return null;
      const res = await fetch(`/api/admin/roles/${selectedRole.id}/permissions`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load role permissions`);
      const data = await res.json();
      return data.data;
    },
    enabled: !!selectedRole,
  });

  // Create role mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roleName,
          description: roleDescription,
          permissions: JSON.stringify(selectedPermissions),
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "Failed to create role");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Role created successfully");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update role mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRole) return;

      // Update role permissions
      const res = await fetch(`/api/admin/roles/${selectedRole.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: roleDescription,
          permissions: JSON.stringify(selectedPermissions),
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "Failed to update role");
      }

      // Update resource permissions
      const permRes = await fetch(`/api/admin/roles/${selectedRole.id}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: resourcePermissions }),
      });
      if (!permRes.ok) {
        const error = await permRes.json();
        throw new Error(error.error?.message || "Failed to update resource permissions");
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success("Role updated successfully");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["role-resources", selectedRole?.id] });
      setEditDialogOpen(false);
      setSelectedRole(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete role mutation
  const deleteMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const res = await fetch(`/api/admin/roles/${roleId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "Failed to delete role");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Role deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setRoleName("");
    setRoleDescription("");
    setSelectedPermissions([]);
    setResourcePermissions([]);
  };

  const openEditDialog = async (role: Role) => {
    setSelectedRole(role);
    setRoleName(role.name);
    setRoleDescription(role.description || "");
    try {
      const perms = JSON.parse(role.permissions);
      setSelectedPermissions(perms);
    } catch {
      setSelectedPermissions([]);
    }

    // Fetch resource permissions for this role
    try {
      const res = await fetch(`/api/admin/roles/${role.id}/permissions`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && data.data?.resourcePermissions) {
        setResourcePermissions(data.data.resourcePermissions);
      } else {
        setResourcePermissions([]);
      }
    } catch {
      setResourcePermissions([]);
    }

    setEditDialogOpen(true);
  };

  const togglePermission = (permission: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permission) ? prev.filter((p) => p !== permission) : [...prev, permission]
    );
  };

  const addResourcePermission = (
    resourceType: string,
    resourceId: string,
    permissionLevel: string
  ) => {
    const newPerm: ResourcePermission = {
      id: Math.random().toString(36).substring(2, 15),
      role_id: selectedRole?.id || "",
      resource_type: resourceType,
      resource_id: resourceId,
      permission_level: permissionLevel as ResourcePermission["permission_level"],
    };
    setResourcePermissions((prev) => [...prev, newPerm]);
  };

  const removeResourcePermission = (index: number) => {
    setResourcePermissions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateResourcePermissionLevel = (
    index: number,
    level: string,
    resourceType: string,
    resourceId: string
  ) => {
    setResourcePermissions((prev) => {
      // If "none" is selected, remove the permission
      if (level === "none") {
        return prev.filter((_, i) => i !== index);
      }

      // If permission exists at index, update it
      if (index >= 0 && index < prev.length) {
        return prev.map((perm, i) =>
          i === index
            ? { ...perm, permission_level: level as ResourcePermission["permission_level"] }
            : perm
        );
      }

      // Otherwise, add new permission
      const newPerm: ResourcePermission = {
        id: Math.random().toString(36).substring(2, 15),
        role_id: selectedRole?.id || "",
        resource_type: resourceType,
        resource_id: resourceId,
        permission_level: level as ResourcePermission["permission_level"],
      };
      return [...prev, newPerm];
    });
  };

  const getRoleBadgeColor = (roleName: string) => {
    if (roleName === "Admin") return "default";
    if (roleName === "Analyst") return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Role Management" description="Manage roles and their granular permissions" />
        <Button onClick={() => setCreateDialogOpen(true)}>
          <ShieldPlus className="h-4 w-4 mr-2" />
          Create Role
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            All Roles
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading roles...</div>
          ) : !roles || roles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No roles found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">
                      <Badge variant={getRoleBadgeColor(role.name)}>{role.name}</Badge>
                    </TableCell>
                    <TableCell className="text-tremor-content">
                      {role.description || "No description"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {(() => {
                          try {
                            const perms = JSON.parse(role.permissions);
                            return perms.slice(0, 2).map((perm: string) => (
                              <Badge key={perm} variant="outline" className="text-xs">
                                {perm}
                              </Badge>
                            ));
                          } catch {
                            return null;
                          }
                        })()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(role)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (role.name === "Admin") {
                            toast.error("Cannot delete Admin role");
                            return;
                          }
                          if (confirm(`Are you sure you want to delete role "${role.name}"?`)) {
                            deleteMutation.mutate(role.id);
                          }
                        }}
                        disabled={role.name === "Admin"}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Role Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Role</DialogTitle>
            <DialogDescription>
              Create a new role and define its global and resource-specific permissions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Role Name *</Label>
              <Input
                id="role-name"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g., Sales Viewer, Report Editor"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
                placeholder="Describe what this role can do..."
                rows={2}
              />
            </div>

            <Tabs defaultValue="global" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="global">Global Permissions</TabsTrigger>
                <TabsTrigger value="resources">Resource Permissions</TabsTrigger>
              </TabsList>

              <TabsContent value="global" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <Label>Global Permissions</Label>
                  {Object.entries(PERMISSION_CATEGORIES).map(([category, perms]) => (
                    <div key={category} className="space-y-2">
                      <h4 className="text-sm font-medium">{category}</h4>
                      <div className="space-y-2 pl-4">
                        {perms.map((perm) => (
                          <div key={perm} className="flex items-center space-x-2">
                            <Checkbox
                              id={`perm-${perm}`}
                              checked={selectedPermissions.includes(perm)}
                              onCheckedChange={() => togglePermission(perm)}
                            />
                            <label
                              htmlFor={`perm-${perm}`}
                              className="text-sm cursor-pointer flex-1"
                            >
                              {perm.replace(/:/g, " → ")}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="resources" className="space-y-4 mt-4">
                <p className="text-tremor-default text-tremor-content">
                  Add specific permissions for individual reports, charts, and dashboards.
                </p>

                {/* Reports Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Reports</h4>
                  </div>
                  <Collapse className="pl-4">
                    {resourcesData?.resources?.reports?.map((resource: Resource) => {
                      const existingPerm = resourcePermissions.find(
                        (p) => p.resource_type === "report" && p.resource_id === resource.id
                      );
                      return (
                        <div key={resource.id} className="flex items-center gap-2 py-2 border-b">
                          <span className="flex-1 text-sm">{resource.title}</span>
                          <Select
                            value={existingPerm?.permission_level || ""}
                            onValueChange={(value) => {
                              if (value) {
                                addResourcePermission("report", resource.id, value);
                              } else {
                                const idx = resourcePermissions.findIndex(
                                  (p) =>
                                    p.resource_type === "report" && p.resource_id === resource.id
                                );
                                if (idx !== -1) removeResourcePermission(idx);
                              }
                            }}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="view">View</SelectItem>
                              <SelectItem value="edit">Edit</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </Collapse>
                </div>

                {/* Charts Section */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Charts</h4>
                  <Collapse className="pl-4">
                    {resourcesData?.resources?.charts?.map((resource: Resource) => {
                      const existingPerm = resourcePermissions.find(
                        (p) => p.resource_type === "chart" && p.resource_id === resource.id
                      );
                      return (
                        <div key={resource.id} className="flex items-center gap-2 py-2 border-b">
                          <span className="flex-1 text-sm">{resource.title}</span>
                          <Select
                            value={existingPerm?.permission_level || ""}
                            onValueChange={(value) => {
                              if (value) {
                                addResourcePermission("chart", resource.id, value);
                              } else {
                                const idx = resourcePermissions.findIndex(
                                  (p) =>
                                    p.resource_type === "chart" && p.resource_id === resource.id
                                );
                                if (idx !== -1) removeResourcePermission(idx);
                              }
                            }}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="view">View</SelectItem>
                              <SelectItem value="edit">Edit</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </Collapse>
                </div>

                {/* Dashboards Section */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Dashboards</h4>
                  <Collapse className="pl-4">
                    {resourcesData?.resources?.dashboards?.map((resource: Resource) => {
                      const existingPerm = resourcePermissions.find(
                        (p) => p.resource_type === "dashboard" && p.resource_id === resource.id
                      );
                      return (
                        <div key={resource.id} className="flex items-center gap-2 py-2 border-b">
                          <span className="flex-1 text-sm">{resource.title}</span>
                          <Select
                            value={existingPerm?.permission_level || ""}
                            onValueChange={(value) => {
                              if (value) {
                                addResourcePermission("dashboard", resource.id, value);
                              } else {
                                const idx = resourcePermissions.findIndex(
                                  (p) =>
                                    p.resource_type === "dashboard" && p.resource_id === resource.id
                                );
                                if (idx !== -1) removeResourcePermission(idx);
                              }
                            }}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="view">View</SelectItem>
                              <SelectItem value="edit">Edit</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </Collapse>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={
                !roleName ||
                (selectedPermissions.length === 0 && resourcePermissions.length === 0) ||
                createMutation.isPending
              }
            >
              {createMutation.isPending ? "Creating..." : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Update global and resource-specific permissions for{" "}
              <strong>{selectedRole?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-role-description">Description</Label>
              <Textarea
                id="edit-role-description"
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
                placeholder="Describe what this role can do..."
                rows={2}
              />
            </div>

            <Tabs defaultValue="global" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="global">Global Permissions</TabsTrigger>
                <TabsTrigger value="resources">Resource Permissions</TabsTrigger>
              </TabsList>

              <TabsContent value="global" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <Label>Global Permissions</Label>
                  {Object.entries(PERMISSION_CATEGORIES).map(([category, perms]) => (
                    <div key={category} className="space-y-2">
                      <h4 className="text-sm font-medium">{category}</h4>
                      <div className="space-y-2 pl-4">
                        {perms.map((perm) => (
                          <div key={perm} className="flex items-center space-x-2">
                            <Checkbox
                              id={`edit-perm-${perm}`}
                              checked={selectedPermissions.includes(perm)}
                              onCheckedChange={() => togglePermission(perm)}
                            />
                            <label
                              htmlFor={`edit-perm-${perm}`}
                              className="text-sm cursor-pointer flex-1"
                            >
                              {perm.replace(/:/g, " → ")}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="resources" className="space-y-4 mt-4">
                <p className="text-tremor-default text-tremor-content">
                  Add specific permissions for individual reports, charts, and dashboards.
                </p>

                {/* Reports Section */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Reports</h4>
                  <Collapse className="pl-4">
                    {resourcesData?.resources?.reports?.map((resource: Resource) => {
                      const existingPerm = resourcePermissions.find(
                        (p) => p.resource_type === "report" && p.resource_id === resource.id
                      );
                      return (
                        <div key={resource.id} className="flex items-center gap-2 py-2 border-b">
                          <span className="flex-1 text-sm">{resource.title}</span>
                          <Select
                            value={existingPerm?.permission_level || ""}
                            onValueChange={(value) =>
                              updateResourcePermissionLevel(
                                resourcePermissions.findIndex(
                                  (p) =>
                                    p.resource_type === "report" && p.resource_id === resource.id
                                ) || -1,
                                value,
                                "report",
                                resource.id
                              )
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="view">View</SelectItem>
                              <SelectItem value="edit">Edit</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </Collapse>
                </div>

                {/* Charts Section */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Charts</h4>
                  <Collapse className="pl-4">
                    {resourcesData?.resources?.charts?.map((resource: Resource) => {
                      const existingPerm = resourcePermissions.find(
                        (p) => p.resource_type === "chart" && p.resource_id === resource.id
                      );
                      return (
                        <div key={resource.id} className="flex items-center gap-2 py-2 border-b">
                          <span className="flex-1 text-sm">{resource.title}</span>
                          <Select
                            value={existingPerm?.permission_level || ""}
                            onValueChange={(value) =>
                              updateResourcePermissionLevel(
                                resourcePermissions.findIndex(
                                  (p) =>
                                    p.resource_type === "chart" && p.resource_id === resource.id
                                ) || -1,
                                value,
                                "chart",
                                resource.id
                              )
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="view">View</SelectItem>
                              <SelectItem value="edit">Edit</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </Collapse>
                </div>

                {/* Dashboards Section */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Dashboards</h4>
                  <Collapse className="pl-4">
                    {resourcesData?.resources?.dashboards?.map((resource: Resource) => {
                      const existingPerm = resourcePermissions.find(
                        (p) => p.resource_type === "dashboard" && p.resource_id === resource.id
                      );
                      return (
                        <div key={resource.id} className="flex items-center gap-2 py-2 border-b">
                          <span className="flex-1 text-sm">{resource.title}</span>
                          <Select
                            value={existingPerm?.permission_level || ""}
                            onValueChange={(value) =>
                              updateResourcePermissionLevel(
                                resourcePermissions.findIndex(
                                  (p) =>
                                    p.resource_type === "dashboard" && p.resource_id === resource.id
                                ) || -1,
                                value,
                                "dashboard",
                                resource.id
                              )
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="view">View</SelectItem>
                              <SelectItem value="edit">Edit</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </Collapse>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
