import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Key, Shield, Trash2, UserPlus } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import type { Role, User } from "@/types/database";
import { listUsers, listRoles, createUser, updateUser, deleteUser } from "@/server-fns/admin";
import { PageHeader } from "@/components/layout/page-header";

export const Route = createFileRoute("/_authed/admin/users/")({
  component: UsersManagementPage,
});

function UsersManagementPage() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [assignRoleDialogOpen, setAssignRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [isUserActive, setIsUserActive] = useState(true);

  // Fetch users
  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const response = await fetch("/api/admin/users");
      const result = await response.json();
      return result.data || [];
    },
  });

  const users = usersData as User[] | undefined;

  // Fetch roles for dropdown
  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["roles"],
    queryFn: async () => {
      const result = await listRoles();
      return result || [];
    },
  });

  // Map user roles to expected format
  const userRoles = selectedUser?.roles?.map((r: any) => ({ role_id: r.id, role_name: r.name })) || [];
  const refetchUserRoles = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  };

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      return await createUser({
        email: newUserEmail,
        password: newUserPassword,
        displayName: newUserName,
        isActive: isUserActive,
      });
    },
    onSuccess: () => {
      toast.success("User created successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setCreateDialogOpen(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setIsUserActive(true);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Assign role mutation
  const assignRoleMutation = useMutation({
    mutationFn: async ({ roleId }: { roleId: string }) => {
      if (!selectedUser) return;
      const currentRoleIds = selectedUser.roles?.map((r: any) => r.id) || [];
      return await updateUser({
        id: selectedUser.id,
        roleIds: [...currentRoleIds, roleId],
      });
    },
    onSuccess: () => {
      toast.success("Role assigned successfully");
      refetchUserRoles();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Remove role mutation
  const removeRoleMutation = useMutation({
    mutationFn: async ({ roleId }: { roleId: string }) => {
      if (!selectedUser) return;
      const currentRoleIds = selectedUser.roles?.map((r: any) => r.id) || [];
      const updatedRoleIds = currentRoleIds.filter((id: string) => id !== roleId);
      return await updateUser({
        id: selectedUser.id,
        roleIds: updatedRoleIds,
      });
    },
    onSuccess: () => {
      toast.success("Role removed successfully");
      refetchUserRoles();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Toggle user active status
  const toggleActiveMutation = useMutation({
    mutationFn: async (user: User) => {
      return await updateUser({
        id: user.id,
        isActive: !user.is_active,
      });
    },
    onSuccess: () => {
      toast.success("User updated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="User Management" description="Manage user accounts and assign roles" />
        <Button onClick={() => setCreateDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Create User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            All Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingUsers ? (
            <div className="text-center py-8 text-muted-foreground">Loading users...</div>
          ) : !users || users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No users found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.display_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "default" : "secondary"}>
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {user.roles?.map((role: { id: string; name: string }) => (
                          <Badge key={role.id} variant="outline" className="text-xs">
                            {role.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-tremor-content">
                      {formatDateTime(user.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user);
                          setAssignRoleDialogOpen(true);
                        }}
                      >
                        <Key className="h-4 w-4 mr-2" />
                        Roles
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActiveMutation.mutate(user)}
                      >
                        {user.is_active ? "Disable" : "Enable"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>Create a new user account</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Name *</Label>
              <Input
                id="user-name"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email *</Label>
              <Input
                id="user-email"
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password">Password *</Label>
              <Input
                id="user-password"
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="•••••••••"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="user-active" checked={isUserActive} onCheckedChange={setIsUserActive} />
              <Label htmlFor="user-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={
                !newUserName || !newUserEmail || !newUserPassword || createMutation.isPending
              }
            >
              {createMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Roles Dialog */}
      <Dialog open={assignRoleDialogOpen} onOpenChange={setAssignRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage User Roles</DialogTitle>
            <DialogDescription>
              Assign or remove roles for <strong>{selectedUser?.display_name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Current Roles</Label>
              <div className="mt-2 space-y-2">
                {userRoles.length === 0 ? (
                  <p className="text-tremor-default text-tremor-content">No roles assigned</p>
                ) : (
                  userRoles.map((ur) => (
                    <div
                      key={ur.role_id}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <Badge variant="secondary">{ur.role_name}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRoleMutation.mutate({ roleId: ur.role_id })}
                        disabled={removeRoleMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="assign-role">Assign Role</Label>
              <Select
                value=""
                onValueChange={(value) => assignRoleMutation.mutate({ roleId: value })}
              >
                <SelectTrigger id="assign-role">
                  <SelectValue placeholder="Select a role to assign..." />
                </SelectTrigger>
                <SelectContent>
                  {roles
                    .filter((r) => !userRoles.some((ur) => ur.role_id === r.id))
                    .map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name} - {role.description || "No description"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setAssignRoleDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
