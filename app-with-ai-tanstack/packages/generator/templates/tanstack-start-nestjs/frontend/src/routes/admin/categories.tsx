/**
 * Application Dictionary — Entity Categories
 *
 * Maintains the categories the dashboard groups business entities by, and lets
 * an administrator move entities between them.
 *
 */

import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Loader2,
  Pencil,
  Plus,
  Star,
  Tags,
  Trash2,
  X,
} from 'lucide-react';
import { ADSidebar } from '@/components/admin/ad-sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { Icon } from '@/components/ui/icon';

export const Route = createFileRoute('/admin/categories')({
  component: CategoriesPage,
});

interface Category {
  sys_category_id: string;
  name: string;
  code: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  seq_no: number;
  is_default: boolean;
  is_active: boolean;
}

interface TableRow {
  sys_table_id: string;
  table_name: string;
  name: string;
  description?: string | null;
  sys_category_id?: string | null;
}

interface CategoryForm {
  name: string;
  code: string;
  description: string;
  icon: string;
  color: string;
  seq_no: number;
  is_default: boolean;
  is_active: boolean;
}

const EMPTY_FORM: CategoryForm = {
  name: '',
  code: '',
  description: '',
  icon: '',
  color: '',
  seq_no: 0,
  is_default: false,
  is_active: true,
};

/**
 * Inline style for the colour preview swatch.
 *
 * Built in a helper rather than written as an inline object literal because a
 * doubled brace in JSX would be read as a template expression when this file is
 * generated.
 */
function swatch(color: string): React.CSSProperties {
  return { backgroundColor: color };
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function CategoriesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Category | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () =>
      apiClient.get<{ data: Category[] }>('/sys/categories', { includeInactive: 'true' }),
  });

  const tablesQuery = useQuery({
    queryKey: ['admin', 'categories', 'tables'],
    queryFn: () => apiClient.get<{ data: TableRow[] }>('/sys/tables', { limit: 500 }),
  });

  const categories = useMemo(
    () =>
      [...(categoriesQuery.data?.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [categoriesQuery.data],
  );

  const businessTables = useMemo(
    () =>
      (tablesQuery.data?.data ?? [])
        .filter((t) => t.table_name?.startsWith('bus_'))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [tablesQuery.data],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'categories'] });
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: CategoryForm & { id?: string }) => {
      const body = {
        name: payload.name.trim(),
        code: payload.code.trim() || slugify(payload.name),
        description: payload.description.trim() || null,
        icon: payload.icon.trim() || null,
        color: payload.color.trim() || null,
        seq_no: Number(payload.seq_no) || 0,
        is_default: payload.is_default,
        is_active: payload.is_active,
      };
      return payload.id
        ? apiClient.put(`/sys/categories/${payload.id}`, body)
        : apiClient.post('/sys/categories', body);
    },
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: (error: any) => {
      setFormError(error?.message ?? 'Could not save the category');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/sys/categories/${id}`),
    onSuccess: invalidate,
  });

  const assignMutation = useMutation({
    mutationFn: ({ tableId, categoryId }: { tableId: string; categoryId: string }) =>
      categoryId
        ? apiClient.post(`/sys/categories/${categoryId}/entities`, { tableIds: [tableId] })
        : apiClient.post('/sys/categories/unassign', { tableIds: [tableId] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'categories', 'tables'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'categories'] });
    },
  });

  // Keep the code field in step with the name until the user edits it directly.
  const [codeTouched, setCodeTouched] = useState(false);
  useEffect(() => {
    if (!codeTouched && !editing) {
      setForm((prev) => ({ ...prev, code: slugify(prev.name) }));
    }
  }, [form.name, codeTouched, editing]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setCodeTouched(false);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setForm({
      name: category.name,
      code: category.code,
      description: category.description ?? '',
      icon: category.icon ?? '',
      color: category.color ?? '',
      seq_no: category.seq_no,
      is_default: category.is_default,
      is_active: category.is_active,
    });
    setCodeTouched(true);
    setFormError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) {
      setFormError('Name is required');
      return;
    }
    saveMutation.mutate({ ...form, id: editing?.sys_category_id });
  }

  const isLoading = categoriesQuery.isLoading || tablesQuery.isLoading;

  return (
    <ADSidebar>
      <div className="p-6 space-y-6" data-testid="admin-categories">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Tags className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold">Entity Categories</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Group business entities into sections. The dashboard renders one block per
                category, ordered by name.
              </p>
            </div>
          </div>
          <Button onClick={openCreate} data-testid="new-category">
            <Plus className="w-4 h-4 mr-2" />
            New Category
          </Button>
        </div>

        {/* ---- Category form ------------------------------------------- */}
        {showForm && (
          <Card data-testid="category-form">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{editing ? `Edit “${editing.name}”` : 'New Category'}</CardTitle>
              <Button variant="ghost" size="sm" onClick={closeForm} aria-label="Close">
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">
                    Name <span className="text-destructive">*</span>
                  </span>
                  <input
                    name="name"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="swiss-input h-9 px-3 text-sm"
                    placeholder="Compound Management"
                  />
                  <span className="text-xs text-muted-foreground">
                    Shown as the group heading on the dashboard, and its sort key.
                  </span>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Code</span>
                  <input
                    name="code"
                    value={form.code}
                    onChange={(e) => {
                      setCodeTouched(true);
                      setForm({ ...form, code: e.target.value });
                    }}
                    className="swiss-input h-9 px-3 text-sm font-mono"
                    placeholder="compound-management"
                  />
                  <span className="text-xs text-muted-foreground">
                    Stable identifier. Derived from the name when left blank.
                  </span>
                </label>

                <label className="flex flex-col gap-1.5 md:col-span-2">
                  <span className="text-sm font-medium">Description</span>
                  <textarea
                    name="description"
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="swiss-input px-3 py-2 text-sm"
                    placeholder="Registration and structural data for compounds"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Icon</span>
                  <input
                    name="icon"
                    value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    className="swiss-input h-9 px-3 text-sm"
                    placeholder="FlaskConical"
                  />
                  <span className="text-xs text-muted-foreground">
                    Any lucide-react icon name.
                  </span>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Colour</span>
                  <div className="flex items-center gap-2">
                    <input
                      name="color"
                      value={form.color}
                      onChange={(e) => setForm({ ...form, color: e.target.value })}
                      className="swiss-input h-9 px-3 text-sm flex-1 font-mono"
                      placeholder="#6366f1"
                    />
                    {form.color && (
                      <span
                        className="w-9 h-9 rounded-md border border-border flex-shrink-0"
                        style={swatch(form.color)}
                        aria-hidden
                      />
                    )}
                  </div>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Sequence</span>
                  <input
                    name="seq_no"
                    type="number"
                    value={form.seq_no}
                    onChange={(e) => setForm({ ...form, seq_no: Number(e.target.value) })}
                    className="swiss-input h-9 px-3 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">
                    Ordering hint for admin listings.
                  </span>
                </label>

                <div className="flex flex-col gap-2 justify-center">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.is_default}
                      onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                    />
                    Default category for uncategorised entities
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    />
                    Active
                  </label>
                </div>

                {formError && (
                  <p className="md:col-span-2 text-sm text-destructive flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {formError}
                  </p>
                )}

                <div className="md:col-span-2 flex gap-2">
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    {editing ? 'Save changes' : 'Create category'}
                  </Button>
                  <Button type="button" variant="outline" onClick={closeForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ---- Category list ------------------------------------------- */}
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground p-8">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading categories…
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Categories ({categories.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm" data-testid="categories-table">
                <thead className="border-b border-border">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Code</th>
                    <th className="px-4 py-2 font-medium">Description</th>
                    <th className="px-4 py-2 font-medium">Entities</th>
                    <th className="px-4 py-2 font-medium w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => {
                    const count = businessTables.filter(
                      (t) => t.sys_category_id === category.sys_category_id,
                    ).length;
                    return (
                      <tr
                        key={category.sys_category_id}
                        className="border-b border-border last:border-0"
                        data-testid={`category-row-${category.code}`}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {category.icon && (
                              <Icon name={category.icon} size={16} className="text-primary" />
                            )}
                            <span className="font-medium">{category.name}</span>
                            {category.is_default && (
                              <Star className="w-3.5 h-3.5 text-amber-500" aria-label="Default" />
                            )}
                            {!category.is_active && (
                              <span className="text-xs text-muted-foreground">(inactive)</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {category.code}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground max-w-md truncate">
                          {category.description ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums">{count}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(category)}
                              aria-label={`Edit ${category.name}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteMutation.mutate(category.sys_category_id)}
                              aria-label={`Delete ${category.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {categories.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No categories yet — create one to group your entities.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* ---- Entity assignment --------------------------------------- */}
        {!isLoading && (
          <Card>
            <CardHeader>
              <CardTitle>Entity Assignment ({businessTables.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm" data-testid="assignment-table">
                <thead className="border-b border-border">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Entity</th>
                    <th className="px-4 py-2 font-medium">Table</th>
                    <th className="px-4 py-2 font-medium w-72">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {businessTables.map((table) => (
                    <tr
                      key={table.sys_table_id}
                      className="border-b border-border last:border-0"
                      data-testid={`assign-row-${table.table_name}`}
                    >
                      <td className="px-4 py-2.5 font-medium">{table.name}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {table.table_name}
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          className="swiss-input h-8 px-2 text-sm w-full"
                          value={table.sys_category_id ?? ''}
                          onChange={(e) =>
                            assignMutation.mutate({
                              tableId: table.sys_table_id,
                              categoryId: e.target.value,
                            })
                          }
                          aria-label={`Category for ${table.name}`}
                        >
                          <option value="">— Uncategorized —</option>
                          {categories
                            .filter((c) => c.is_active)
                            .map((c) => (
                              <option key={c.sys_category_id} value={c.sys_category_id}>
                                {c.name}
                              </option>
                            ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </ADSidebar>
  );
}
