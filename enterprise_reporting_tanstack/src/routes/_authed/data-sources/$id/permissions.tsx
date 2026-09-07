import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Plus, Shield, Table as TableIcon, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { PageHeader } from "@/components/layout/page-header";
import type {
  DataSource,
  DsEntityPermission,
  DsEntityPermissionLevel,
  DsEntityType,
  DsRole,
  DsUserRoleJoinRow,
  SchemaApiResponse,
  UserListItem,
} from "@/types/database";

const PERMISSION_LEVELS: { value: DsEntityPermissionLevel; label: string }[] = [
  { value: "select", label: "Select (Read)" },
  { value: "insert", label: "Insert" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "all", label: "All" },
];

const ENTITY_TYPES: { value: DsEntityType; label: string }[] = [
  { value: "table", label: "Table" },
  { value: "view", label: "View" },
];

export const Route = createFileRoute("/_authed/data-sources/$id/permissions")({
  component: DataSourcePermissionsPage,
});

function DataSourcePermissionsPage() {
  const { id: dataSourceId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showCreateRole, setShowCreateRole] = useState(false);
  const [showAssignUser, setShowAssignUser] = useState(false);
  const [showAddPermission, setShowAddPermission] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");

  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [assignRoleId, setAssignRoleId] = useState("");
  const [permEntityName, setPermEntityName] = useState("");
  const [permEntityType, setPermEntityType] = useState<DsEntityType>("table");
  const [permLevel, setPermLevel] = useState<DsEntityPermissionLevel>("select");
  const [permRoleId, setPermRoleId] = useState("");

  // Fetch data source info
  const { data: dataSource } = useQuery<DataSource>({
    queryKey: ["data-source", dataSourceId],
    queryFn: async () => {
      const res = await fetch(`/api/data-sources/${dataSourceId}`);
      const json = await res.json();
      return json.data;
    },
  });

  // Fetch DS roles
  const { data: roles = [], isLoading: rolesLoading } = useQuery<DsRole[]>({
    queryKey: ["ds-roles", dataSourceId],
    queryFn: async () => {
      const res = await fetch(`/api/data-sources/${dataSourceId}/roles`);
      const json = await res.json();
      return json.data || [];
    },
  });

  // Fetch DS user-role assignments
  const { data: userRoles = [], isLoading: userRolesLoading } = useQuery<DsUserRoleJoinRow[]>({
    queryKey: ["ds-user-roles", dataSourceId],
    queryFn: async () => {
      const res = await fetch(`/api/data-sources/${dataSourceId}/user-roles`);
      const json = await res.json();
      return json.data || [];
    },
  });

  // Fetch entity permissions
  const { data: entityPermissions = [], isLoading: permissionsLoading } = useQuery<
    DsEntityPermission[]
  >({
    queryKey: ["ds-entity-permissions", dataSourceId, selectedRoleId],
    queryFn: async () => {
      const url = selectedRoleId
        ? `/api/data-sources/${dataSourceId}/entity-permissions?ds_role_id=${selectedRoleId}`
        : `/api/data-sources/${dataSourceId}/entity-permissions`;
      const res = await fetch(url);
      const json = await res.json();
      return json.data || [];
    },
  });

  // Fetch schema for entity name autocomplete
  const { data: schemaData } = useQuery<SchemaApiResponse>({
    queryKey: ["ds-schema", dataSourceId],
    queryFn: async () => {
      const res = await fetch(`/api/sql/schema/${dataSourceId}`);
      const json = await res.json();
      return json.data;
    },
  });

  // Fetch users for assignment
  const { data: users = [] } = useQuery<UserListItem[]>({
    queryKey: ["users-list"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      const json = await res.json();
      return json.data || [];
    },
  });

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const res = await fetch(`/api/data-sources/${dataSourceId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "Failed to create role");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ds-roles", dataSourceId] });
      setShowCreateRole(false);
      setRoleName("");
      setRoleDescription("");
      toast.success("Role created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Assign user-role mutation
  const assignUserRoleMutation = useMutation({
    mutationFn: async (data: { user_id: string; ds_role_id: string }) => {
      const res = await fetch(`/api/data-sources/${dataSourceId}/user-roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "Failed to assign user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ds-user-roles", dataSourceId] });
      setShowAssignUser(false);
      setAssignUserId("");
      setAssignRoleId("");
      toast.success("User assigned to role");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Remove user-role mutation
  const removeUserRoleMutation = useMutation({
    mutationFn: async (data: { user_id: string; ds_role_id: string }) => {
      const res = await fetch(
        `/api/data-sources/${dataSourceId}/user-roles?user_id=${data.user_id}&ds_role_id=${data.ds_role_id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to remove assignment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ds-user-roles", dataSourceId] });
      toast.success("User removed from role");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Add entity permission mutation
  const addPermissionMutation = useMutation({
    mutationFn: async (data: {
      ds_role_id: string;
      entity_name: string;
      entity_type: DsEntityType;
      permission_level: DsEntityPermissionLevel;
    }) => {
      const res = await fetch(`/api/data-sources/${dataSourceId}/entity-permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "Failed to add permission");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ds-entity-permissions", dataSourceId] });
      setShowAddPermission(false);
      setPermEntityName("");
      setPermEntityType("table");
      setPermLevel("select");
      setPermRoleId("");
      toast.success("Entity permission added");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete entity permission mutation
  const deletePermissionMutation = useMutation({
    mutationFn: async (permissionId: string) => {
      const res = await fetch(
        `/api/data-sources/${dataSourceId}/entity-permissions?permission_id=${permissionId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete permission");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ds-entity-permissions", dataSourceId] });
      toast.success("Permission removed");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const res = await fetch(`/api/data-sources/${dataSourceId}/roles/${roleId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete role");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ds-roles", dataSourceId] });
      queryClient.invalidateQueries({ queryKey: ["ds-entity-permissions", dataSourceId] });
      queryClient.invalidateQueries({ queryKey: ["ds-user-roles", dataSourceId] });
      toast.success("Role deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const entityNames = schemaData?.tables?.map((t) => t.name) || [];
  const viewNames = schemaData?.views?.map((v) => v.name) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/data-sources/" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Data Source Entity Permissions" description="{dataSource?.name || &quot;Loading...&quot;} - Manage roles, users, and entity-level access control" />
      </div>

      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="h-4 w-4" /> Roles
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" /> User Assignments
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2">
            <TableIcon className="h-4 w-4" /> Entity Permissions
          </TabsTrigger>
        </TabsList>

        {/* Roles Tab */}
        <TabsContent value="roles">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Data Source Roles</CardTitle>
                <CardDescription>
                  Roles specific to this data source for entity-level access control
                </CardDescription>
              </div>
              <Button onClick={() => setShowCreateRole(true)}>
                <Plus className="mr-2 h-4 w-4" /> Create Role
              </Button>
            </CardHeader>
            <CardContent>
              {rolesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : roles.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No roles defined for this data source yet. Create a role to get started.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell className="font-medium">{role.name}</TableCell>
                        <TableCell>{role.description || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={role.is_active ? "default" : "secondary"}>
                            {role.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteRoleMutation.mutate(role.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Assignments Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>User-Role Assignments</CardTitle>
                <CardDescription>
                  Assign users to data source roles to control entity-level access
                </CardDescription>
              </div>
              <Button onClick={() => setShowAssignUser(true)} disabled={roles.length === 0}>
                <Plus className="mr-2 h-4 w-4" /> Assign User
              </Button>
            </CardHeader>
            <CardContent>
              {userRolesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : userRoles.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No users assigned to data source roles yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userRoles.map((ur: DsUserRoleJoinRow) => (
                      <TableRow key={`${ur.user_id}-${ur.ds_role_id}`}>
                        <TableCell className="font-medium">{ur.user_display_name}</TableCell>
                        <TableCell>{ur.user_email}</TableCell>
                        <TableCell>
                          <Badge>{ur.role_name}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              removeUserRoleMutation.mutate({
                                user_id: ur.user_id,
                                ds_role_id: ur.ds_role_id,
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Entity Permissions Tab */}
        <TabsContent value="permissions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Entity Permissions</CardTitle>
                <CardDescription>
                  Define which tables/views each role can access within this data source
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => setShowAddPermission(true)} disabled={roles.length === 0}>
                  <Plus className="mr-2 h-4 w-4" /> Add Permission
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {permissionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : entityPermissions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No entity permissions defined. Add permissions to control access to specific
                  tables and views.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entity</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Permission</TableHead>
                      <TableHead>Column Restrictions</TableHead>
                      <TableHead>Row Filter</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entityPermissions.map((perm) => {
                      const role = roles.find((r) => r.id === perm.ds_role_id);
                      return (
                        <TableRow key={perm.id}>
                          <TableCell className="font-mono text-sm font-medium">
                            {perm.entity_schema ? `${perm.entity_schema}.` : ""}
                            {perm.entity_name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{perm.entity_type}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge>{role?.name || perm.ds_role_id}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={perm.permission_level === "all" ? "default" : "secondary"}
                            >
                              {perm.permission_level}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-tremor-label text-tremor-content">
                            {perm.column_restrictions
                              ? JSON.parse(perm.column_restrictions).join(", ")
                              : "All columns"}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {perm.row_filter || "-"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deletePermissionMutation.mutate(perm.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Role Dialog */}
      <Dialog open={showCreateRole} onOpenChange={setShowCreateRole}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Data Source Role</DialogTitle>
            <DialogDescription>
              Create a new role for controlling access to entities within this data source.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="role-name">Role Name</Label>
              <Input
                id="role-name"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g. Sales Analyst"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role-desc">Description</Label>
              <Input
                id="role-desc"
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateRole(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                createRoleMutation.mutate({ name: roleName, description: roleDescription })
              }
              disabled={!roleName.trim() || createRoleMutation.isPending}
            >
              {createRoleMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign User Dialog */}
      <Dialog open={showAssignUser} onOpenChange={setShowAssignUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User to Role</DialogTitle>
            <DialogDescription>
              Assign a user to a data source role to grant entity-level access.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>User</Label>
              <Select value={assignUserId} onValueChange={setAssignUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u: UserListItem) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.display_name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={assignRoleId} onValueChange={setAssignRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignUser(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                assignUserRoleMutation.mutate({ user_id: assignUserId, ds_role_id: assignRoleId })
              }
              disabled={!assignUserId || !assignRoleId || assignUserRoleMutation.isPending}
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Permission Dialog */}
      <Dialog open={showAddPermission} onOpenChange={setShowAddPermission}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Entity Permission</DialogTitle>
            <DialogDescription>
              Grant a role access to a specific table or view in this data source.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={permRoleId} onValueChange={setPermRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Entity Type</Label>
              <Select
                value={permEntityType}
                onValueChange={(v) => setPermEntityType(v as DsEntityType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Entity Name</Label>
              <Select value={permEntityName} onValueChange={setPermEntityName}>
                <SelectTrigger>
                  <SelectValue placeholder="Select entity" />
                </SelectTrigger>
                <SelectContent>
                  {(permEntityType === "table" ? entityNames : viewNames).map((name: string) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Permission Level</Label>
              <Select
                value={permLevel}
                onValueChange={(v) => setPermLevel(v as DsEntityPermissionLevel)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERMISSION_LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPermission(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                addPermissionMutation.mutate({
                  ds_role_id: permRoleId,
                  entity_name: permEntityName,
                  entity_type: permEntityType,
                  permission_level: permLevel,
                })
              }
              disabled={!permRoleId || !permEntityName || addPermissionMutation.isPending}
            >
              Add Permission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
