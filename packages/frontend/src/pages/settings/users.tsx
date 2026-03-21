import { useUsers, useUpdateUserRole, useUpdateUserStatus } from "@frontend/api/users.js";
import { useAuth } from "@frontend/hooks/use-auth.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@frontend/components/ui/card.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@frontend/components/ui/table.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { Button } from "@frontend/components/ui/button.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@frontend/components/ui/select.js";
import { Skeleton } from "@frontend/components/ui/skeleton.js";
import { toast } from "sonner";
import { USER_ROLES } from "@nexum/shared";
import type { UserRole } from "@nexum/shared";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  dispatcher: "Dispatcher",
  finance: "Finance",
  compliance: "Compliance",
  read_only: "Read Only",
};

export function UserManagementPage(): React.JSX.Element {
  const { data: users, isLoading } = useUsers();
  const auth = useAuth();
  const updateRole = useUpdateUserRole();
  const updateStatus = useUpdateUserStatus();

  function handleRoleChange(userId: string, role: string): void {
    updateRole.mutate(
      { userId, role: role as UserRole },
      {
        onSuccess: () => toast.success("Role updated"),
        onError: (err) => toast.error(err.message),
      },
    );
  }

  function handleToggleStatus(userId: string, currentStatus: string): void {
    const newStatus = currentStatus === "active" ? "deactivated" : "active";
    updateStatus.mutate(
      { userId, status: newStatus },
      {
        onSuccess: () => toast.success(`User ${newStatus === "active" ? "activated" : "deactivated"}`),
        onError: (err) => toast.error(err.message),
      },
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Users</h2>
        <p className="text-muted-foreground">Manage team members and their roles.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>{users?.length ?? 0} users in this organisation.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user) => {
                const isSelf = user.userId === auth.auth?.userId;
                const canManage = auth.can("manage:users") && !isSelf;

                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.displayName || "—"}
                      {user.isOwner && (
                        <Badge variant="outline" className="ml-2 text-xs">Owner</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      {canManage ? (
                        <Select value={user.role} onValueChange={(v) => handleRoleChange(user.id, v)}>
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {USER_ROLES.map((role) => (
                              <SelectItem key={role} value={role}>
                                {ROLE_LABELS[role] ?? role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary">{ROLE_LABELS[user.role] ?? user.role}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.status === "active" ? "default" : "destructive"}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(user.id, user.status)}
                          disabled={updateStatus.isPending}
                        >
                          {user.status === "active" ? "Deactivate" : "Activate"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
