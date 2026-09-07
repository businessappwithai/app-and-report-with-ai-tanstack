import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { WindowHelpDialog } from '@/components/admin/window-help-dialog';
import { apiClient } from '@/lib/api-client';
import { UserCog, ArrowLeft, Loader2, AlertCircle, Star } from 'lucide-react';

export const Route = createFileRoute('/admin/roles')({
  component: RolesPage,
});

interface SysRole {
  sys_role_id: string;
  name: string;
  description?: string;
  is_master_role: boolean;
  is_active: boolean;
  user_count?: number;
}

function RolesPage() {
  const { data, isLoading, error } = useQuery<{ data: SysRole[] }>({
    queryKey: ['admin', 'sys-roles'],
    queryFn: () => apiClient.get('/sys/roles'),
  });

  const roles = data?.data ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="container-swiss">
          <div className="flex h-14 items-center gap-3">
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <UserCog className="w-4 h-4 text-primary" />
            <h1 className="font-display text-lg font-semibold">Role Management</h1>
            <WindowHelpDialog windowName="Role" entityLabel="Role" />
          </div>
        </div>
      </header>

      <main className="container-swiss py-8">
        {isLoading && (
          <div className="swiss-card p-12 text-center">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
          </div>
        )}
        {error && (
          <div className="swiss-alert-error p-8 text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-destructive" />
            <p>Failed to load roles</p>
          </div>
        )}
        {!isLoading && !error && (
          <div className="swiss-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r.sys_role_id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium flex items-center gap-2">
                      {r.is_master_role && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                      {r.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.description ?? '—'}</td>
                    <td className="px-4 py-3">
                      {r.is_master_role ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Master</span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">Standard</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                        {r.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
                {roles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">No roles found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
