import { useState, useEffect } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/auth-context';
import {
  ArrowRight,
  FileText,
  Search,
  Loader2,
  AlertCircle,
  Database,
  Table2,
  AppWindow,
  Tag,
  BookOpen,
  LayoutGrid,
  ShieldCheck,
  ScrollText,
  Workflow,
  Users,
  UserCog,
  X,
  LogOut,
} from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { Button, buttonVariants } from '@/components/ui/button';
import { toast } from 'sonner';
import { APP_NAME } from "@/lib/app-meta";

// Map admin window names from the DB to frontend icon + route
const ADMIN_WINDOW_META: Record<string, { icon: any; href: string }> = {
  'Table and Column':      { icon: Table2,     href: '/admin/tables' },
  'Window, Tab and Field': { icon: AppWindow,  href: '/admin/windows' },
  'Element':               { icon: Tag,        href: '/admin/elements' },
  'Reference':             { icon: BookOpen,   href: '/admin/references' },
  'Entity Category':       { icon: Tag,        href: '/admin/categories' },
  'Field Layout Manager':  { icon: LayoutGrid, href: '/admin/fields' },
  'Business Rules':        { icon: ShieldCheck,href: '/admin/rules' },
  'Workflow Designer':     { icon: Workflow,   href: '/admin/workflow-definitions' },
  'Audit Log':             { icon: ScrollText, href: '/admin/audit' },
  'User':                  { icon: Users,      href: '/admin/users' },
  'Role':                  { icon: UserCog,    href: '/admin/roles' },
};

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
});

interface TableMetadata {
  sys_table_id: string;
  table_name: string;
  name: string;
  description?: string;
  icon?: string;
  is_active: boolean;
}

interface TablesResponse {
  data: TableMetadata[];
  meta: { total: number; page: number; pageSize: number };
}

/** A dictionary category with the entities assigned to it. */
interface CategoryGroup {
  sys_category_id: string | null;
  name: string;
  code: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  entities: TableMetadata[];
}

/**
 * Categories with their entities, already ordered by category name server-side.
 * The dashboard renders one block per category, separated by a rule.
 */
function useCategoryGroups() {
  return useQuery({
    queryKey: ['dashboard', 'categories'],
    queryFn: () => apiClient.get<{ data: CategoryGroup[] }>('/sys/categories/with-entities'),
    staleTime: 5 * 60 * 1000,
  });
}

function useBusTables() {
  return useQuery({
    queryKey: ['sys-tables', 'bus_+U'],
    queryFn: async () => {
      const [bus, user] = await Promise.all([
        apiClient.get<TablesResponse>('/sys/tables?prefix=bus_'),
        apiClient.get<TablesResponse>('/sys/tables?entity_type=U&limit=100'),
      ]);
      const busData = bus?.data ?? [];
      const userData = user?.data ?? [];
      const seen = new Set(busData.map((t: TableMetadata) => t.sys_table_id));
      const merged = [...busData, ...userData.filter((t: TableMetadata) => !seen.has(t.sys_table_id))];
      return { data: merged, meta: bus?.meta ?? { total: merged.length, page: 1, pageSize: merged.length } };
    },
    staleTime: 10 * 60 * 1000,
  });
}

interface PermissionsResponse {
  role: string;
  isMaster: boolean;
  windows: { sys_window_id: string; name: string; route: string; category: string; is_read_only: boolean }[];
}

function usePermissions() {
  return useQuery<PermissionsResponse>({
    queryKey: ['me', 'permissions'],
    queryFn: () => apiClient.get<PermissionsResponse>('/me/permissions'),
    staleTime: 5 * 60 * 1000,
  });
}

function Dashlet({
  name,
  description,
  icon: IconComp,
  href,
}: {
  name: string;
  // Optional: callers deliberately pass `undefined` for a dashlet that has
  // nothing to add beyond its name.
  description?: string;
  icon?: any;
  href: string;
}) {
  return (
    <Link to={href} className="block group">
      <div className="swiss-card p-5 hover:border-primary/50 transition-all h-full">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              {IconComp ? (
                typeof IconComp === 'string' ? (
                  <Icon name={IconComp} size={20} className="text-primary" />
                ) : (
                  <IconComp className="w-5 h-5" />
                )
              ) : (
                <FileText className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                {name}
              </h3>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-3 line-clamp-2 leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </Link>
  );
}

function DashboardPage() {
  const { data: tablesData, isLoading, error } = useBusTables();
  const { data: categoryData, isLoading: categoriesLoading } = useCategoryGroups();
  const { data: perms, isLoading: permsLoading } = usePermissions();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate({ to: '/auth/login' });
    }
  }, [authLoading, isAuthenticated, navigate]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const handleLogout = async () => {
    await logout();
    navigate({ to: '/auth/login' });
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const busTables = tablesData?.data ?? [];

  // Build admin dashlets from permissions
  const adminWindowsFromPerms = (perms?.windows ?? [])
    .filter(w => w.category === 'admin')
    .map(w => {
      const meta = ADMIN_WINDOW_META[w.name];
      return meta ? { name: w.name, href: meta.href, icon: meta.icon, is_read_only: w.is_read_only } : null;
    })
    .filter(Boolean) as { name: string; href: string; icon: any; is_read_only: boolean }[];

  const query = searchQuery.toLowerCase().trim();
  const filteredBus = query
    ? busTables.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.table_name.toLowerCase().includes(query) ||
          (t.description?.toLowerCase().includes(query) ?? false),
      )
    : busTables;

  const filteredAdmin = query
    ? adminWindowsFromPerms.filter(d => d.name.toLowerCase().includes(query))
    : adminWindowsFromPerms;

  // Entities grouped by category, alphabetical by category name. The search box
  // filters within each group and drops groups that end up empty.
  const categoryGroups = (categoryData?.data ?? [])
    .map((group) => ({
      ...group,
      entities: query
        ? group.entities.filter(
            (t) =>
              t.name.toLowerCase().includes(query) ||
              t.table_name.toLowerCase().includes(query) ||
              (t.description?.toLowerCase().includes(query) ?? false),
          )
        : group.entities,
    }))
    .filter((group) => group.entities.length > 0);

  const groupedEntityCount = categoryGroups.reduce((sum, g) => sum + g.entities.length, 0);

  // Fall back to the flat list only when no categories are configured at all,
  // so an un-migrated database still shows its entities.
  const useGroupedView = (categoryData?.data ?? []).length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="container-swiss">
          <div className="flex h-14 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <h1 className="font-display truncate text-xl font-semibold text-foreground">{APP_NAME}</h1>
            </div>
            <div className="flex min-w-0 items-center gap-3">
              {/* The search box shrinks rather than pushing the account
                  controls off-screen — a fixed width overflowed the header on
                  a 375px viewport. */}
              <div className="relative min-w-0 flex-1 sm:flex-none">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="swiss-input h-9 w-full pl-9 pr-8 text-sm sm:w-56"
                />
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {user && (
                <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                      {getInitials(user.name)}
                    </div>
                    <span className="text-sm font-medium text-foreground hidden md:inline">{user.name}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Log out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container-swiss py-8 space-y-10">
        {/* The manual, above everything else.

            Generation writes public/manual.html beside this application: every
            entity, every field, the processes it runs and the decisions it
            makes, out of the same model these screens are drawn from. It is a
            plain anchor rather than a route because it is a static document the
            router knows nothing about — and it opens in a new tab, since a
            reader wants it beside the screen it describes. */}
        <ManualBanner />

        {/* Loading */}
        {(isLoading || categoriesLoading) && (
          <div className="swiss-card p-12 text-center">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
            <p className="text-muted-foreground mt-4 text-sm">Loading entities...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="swiss-alert-error p-12 text-center">
            <AlertCircle className="w-10 h-10 mx-auto mb-3 text-destructive" />
            <p className="font-semibold">Failed to load entities</p>
            <p className="text-sm text-muted-foreground mt-1">
              Unable to fetch entity list from Application Dictionary
            </p>
          </div>
        )}

        {/* Business Entities — grouped by category, ordered by category name.
            Each group is introduced by its name above a separating rule. */}
        {!isLoading && !error && useGroupedView && groupedEntityCount > 0 && (
          <section data-testid="dashboard-categories">
            {categoryGroups.map((group) => (
              <div
                key={group.code}
                className="mb-10 last:mb-0"
                data-testid={`category-group-${group.code}`}
              >
                {/* Category name sits above the line that separates this group */}
                <div className="flex items-baseline gap-2 mb-2">
                  {group.icon ? (
                    <Icon
                      name={group.icon}
                      size={16}
                      className="text-primary self-center"
                      style={group.color ? { color: group.color } : undefined}
                    />
                  ) : (
                    <Database className="w-4 h-4 text-primary self-center" />
                  )}
                  <h2
                    className="section-header mb-0"
                    style={group.color ? { color: group.color } : undefined}
                    data-testid={`category-name-${group.code}`}
                  >
                    {group.name}
                  </h2>
                  <span className="font-mono-display text-muted-foreground">
                    ({group.entities.length})
                  </span>
                </div>

                <hr className="border-t border-border mb-5" />

                {group.description && (
                  <p className="text-sm text-muted-foreground -mt-3 mb-5">{group.description}</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.entities.map((table) => (
                    <Dashlet
                      key={table.table_name}
                      name={table.name}
                      description={table.description || `Manage ${table.name} records`}
                      icon={table.icon}
                      href={`/${table.name.toLowerCase().replace(/\s+/g, '-')}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Ungrouped fallback — only when no categories exist at all */}
        {!isLoading && !error && !useGroupedView && filteredBus.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-5">
              <Database className="w-4 h-4 text-primary" />
              <h2 className="section-header mb-0">
                Business Entities
              </h2>
              <span className="font-mono-display text-muted-foreground">({filteredBus.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBus.map((table) => (
                <Dashlet
                  key={table.table_name}
                  name={table.name}
                  description={table.description || `Manage ${table.name} records`}
                  icon={table.icon}
                  href={`/${table.name.toLowerCase().replace(/\s+/g, '-')}`}
                />
              ))}
            </div>
          </section>
        )}

        {/* Admin / Dictionary */}
        {filteredAdmin.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-5">
              <LayoutGrid className="w-4 h-4 text-primary" />
              <h2 className="section-header mb-0">
                Application Dictionary
              </h2>
              <span className="font-mono-display text-muted-foreground">({filteredAdmin.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAdmin.map((d) => (
                <Dashlet
                  key={d.href}
                  name={d.name}
                  description={d.is_read_only ? 'View only' : undefined}
                  icon={d.icon}
                  href={d.href}
                />
              ))}
            </div>
          </section>
        )}

        {/* Start over without re-running the setup.

            A generated application arrives with seeded rows so that it can be
            looked at, and whoever has finished looking wants their own data in
            it — which otherwise meant deleting every record by hand, entity by
            entity. Set apart from the dashlet grid rather than sitting in it:
            it is the one control here that cannot be undone, and a destructive
            action that looks like the cards around it is one somebody presses
            by accident.

            Administrator-only, and the server agrees independently —
            DictionaryWriteGuard refuses every non-GET on /sys from anyone else,
            so hiding it here is courtesy rather than the enforcement. */}
        {perms?.isMaster && <PurgeBusinessData />}

        {/* Empty search */}
        {!isLoading && !error && query && groupedEntityCount === 0 && filteredBus.length === 0 && filteredAdmin.length === 0 && (
          <div className="swiss-card p-12 text-center">
            <Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="font-semibold">No results for &ldquo;{searchQuery}&rdquo;</p>
            <p className="text-sm text-muted-foreground mt-1">Try a different search term</p>
          </div>
        )}

        {/*
          A role that may read nothing gets told so.

          `%%rbac … .read` decides what a role sees, and the seeded `User`
          account holds no functional role at all — deliberately, because an
          account that can reach nothing is what demonstrates that a
          restriction restricts. Rendered as bare emptiness it reads as a
          broken build, so it says which of the two it is.
        */}
        {!isLoading && !error && !query && groupedEntityCount === 0 && filteredBus.length === 0 && (
          <div className="swiss-card p-12 text-center">
            <Database className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="font-semibold">Nothing to show</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-prose mx-auto">
              This account holds no role that may read any of this
              application&rsquo;s entities. That is what the model says rather
              than a fault: <code>%%rbac</code> grants read access by role, and
              this one has none. Sign out and pick a role account to see the
              application it was given.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function ManualBanner() {
  return (
    <section className="flex flex-wrap items-center gap-5 rounded-lg border border-border border-l-4 border-l-primary bg-card p-5">
      <div className="flex-1 min-w-[20rem]">
        <h2 className="text-sm font-semibold mb-1">Manual</h2>
        <p className="text-sm text-muted-foreground max-w-prose">
          Every kind of record {APP_NAME} keeps, every field on it, the processes it runs and
          the decisions it makes &mdash; written from the same model this application was
          generated from.
        </p>
      </div>
      {/* An anchor wearing the button's classes: this Button renders a
          <button>, and it has no `asChild`, so a real link is the only way to
          get a new tab out of it. */}
      <a
        href="/manual.html"
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({ variant: 'outline', size: 'sm' })}
      >
        Open the manual
      </a>
    </section>
  );
}

function PurgeBusinessData() {
  const queryClient = useQueryClient();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const result = await apiClient.post<{ deleted: number; tables: number }>(
        '/sys/purge-business-data',
        {},
      );
      toast.success(`Deleted ${result.deleted} record(s) across ${result.tables} table(s)`);
      // Every count on this screen is now wrong, and a stale dashboard after a
      // purge reads as the purge having failed.
      await queryClient.invalidateQueries();
      setArmed(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete the records');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-10 rounded-lg border border-border border-l-4 border-l-destructive bg-card">
      <div className="p-5">
        <h2 className="text-sm font-semibold mb-1">Start from an empty database</h2>
        <p className="text-sm text-muted-foreground mb-4 max-w-prose">
          {armed
            ? 'Every business record is deleted — the seeded rows and anything you have added. The model, the dictionary, the rules and the accounts are untouched. This cannot be undone.'
            : 'Deletes every business record and leaves the application itself in place.'}
        </p>
        <div className="flex flex-wrap gap-2">
          {armed ? (
            <>
              <Button variant="destructive" size="sm" onClick={run} disabled={busy}>
                {busy ? 'Deleting…' : 'Yes, delete every record'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setArmed(false)} disabled={busy}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setArmed(true)}>
              Delete all records
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
