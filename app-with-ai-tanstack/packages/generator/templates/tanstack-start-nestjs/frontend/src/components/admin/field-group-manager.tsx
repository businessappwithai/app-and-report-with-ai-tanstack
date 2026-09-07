/**
 * Field Group Manager
 *
 * Component for managing field groups - add, edit, delete, and reorder groups.
 * Shows groups with their column layouts and field counts.
 */


import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, GripVertical, LayoutGrid, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import {
  type FieldGroup,
  useCreateFieldGroup,
  useDeleteFieldGroup,
  useFieldGroups,
  useUpdateFieldGroup,
} from "@/hooks/use-entities";
import { cn } from "@/lib/utils";

interface FieldGroupManagerProps {
  entityName: string;
}

interface ColumnLayoutOption {
  value: number;
  label: string;
  icon: string;
}

const COLUMN_LAYOUTS: ColumnLayoutOption[] = [
  { value: 1, label: "1 Column", icon: "▯" },
  { value: 2, label: "2 Columns", icon: "▯▯" },
  { value: 3, label: "3 Columns", icon: "▯▯▯" },
  { value: 4, label: "4 Columns", icon: "▯▯▯▯" },
];

export function FieldGroupManager({ entityName }: FieldGroupManagerProps) {
  const { data: groups, isLoading } = useFieldGroups(entityName);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [newGroupMode, setNewGroupMode] = useState(false);

  // Form state for new/edit group
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    columns: 1,
    layout_type: "single",
  });

  // Mutations
  const createMutation = useCreateFieldGroup(entityName);
  const updateMutation = useUpdateFieldGroup(entityName);
  const deleteMutation = useDeleteFieldGroup(entityName);

  // Reset form
  const resetForm = () => {
    setFormData({ name: "", description: "", columns: 1, layout_type: "single" });
    setEditingGroup(null);
    setNewGroupMode(false);
  };

  // Start editing a group
  const startEdit = (group: FieldGroup) => {
    setFormData({
      name: group.name,
      description: group.description || "",
      columns: group.columns,
      layout_type: group.layout_type,
    });
    setEditingGroup(group.sys_field_group_id);
    setNewGroupMode(false);
  };

  // Get layout type from columns
  const getLayoutType = (columns: number): string => {
    switch (columns) {
      case 1:
        return "single";
      case 2:
        return "two-column";
      case 3:
        return "three-column";
      case 4:
        return "four-column";
      default:
        return "single";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading field groups...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Field Groups</h3>
          <p className="text-sm text-muted-foreground">
            Organize fields into sections with multi-column layouts
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setNewGroupMode(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Group
        </button>
      </div>

      {/* New Group Form */}
      {newGroupMode && (
        <div className="border rounded-lg p-6 bg-card">
          <h4 className="text-md font-medium mb-4">Create New Field Group</h4>
          <GroupForm
            formData={formData}
            setFormData={setFormData}
            onCancel={resetForm}
            onSave={() => {
              createMutation.mutate(formData as any, {
                onSuccess: () => {
                  resetForm();
                },
              });
            }}
            isSaving={createMutation.isPending}
          />
        </div>
      )}

      {/* Groups List */}
      <div className="space-y-4">
        {!groups || groups.length === 0 ? (
          <div className="text-center p-8 border rounded-lg border-dashed">
            <p className="text-muted-foreground">No field groups defined yet.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Click "Add Group" to create your first group.
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <GroupCard
              key={group.sys_field_group_id}
              group={group}
              isEditing={editingGroup === group.sys_field_group_id}
              formData={formData}
              setFormData={setFormData}
              onEdit={() => startEdit(group)}
              onCancel={resetForm}
              onSave={() => {
                updateMutation.mutate(
                  { id: group.sys_field_group_id, data: formData as Partial<FieldGroup> },
                  {
                    onSuccess: () => {
                      resetForm();
                    },
                  }
                );
              }}
              onDelete={() => {
                if (
                  confirm(
                    `Are you sure you want to delete "${group.name}"? Fields in this group will become ungrouped.`
                  )
                ) {
                  deleteMutation.mutate(group.sys_field_group_id);
                }
              }}
              isSaving={updateMutation.isPending}
              isDeleting={deleteMutation.isPending}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface GroupFormProps {
  formData: {
    name: string;
    description: string;
    columns: number;
    layout_type: string;
  };
  setFormData: (data: any) => void;
  onCancel: () => void;
  onSave: () => void;
  isSaving?: boolean;
}

function GroupForm({ formData, setFormData, onCancel, onSave, isSaving = false }: GroupFormProps) {
  return (
    <div className="space-y-4">
      {/* Group Name */}
      <div>
        <label className="block text-sm font-medium mb-1">Group Name *</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Personal Information"
          className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Optional description of this group"
          rows={2}
          className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>

      {/* Column Layout */}
      <div>
        <label className="block text-sm font-medium mb-2">Column Layout</label>
        <div className="flex gap-3">
          {COLUMN_LAYOUTS.map((layout) => (
            <button
              key={layout.value}
              type="button"
              onClick={() =>
                setFormData({
                  ...formData,
                  columns: layout.value,
                  layout_type: getLayoutType(layout.value),
                })
              }
              className={cn(
                "flex-1 p-3 border-2 rounded-lg transition-all",
                "hover:border-primary/50",
                formData.columns === layout.value ? "border-primary bg-primary/10" : "border-border"
              )}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="text-2xl tracking-widest opacity-70">{layout.icon}</div>
                <div className="text-xs font-medium">{layout.label}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="px-4 py-2 border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!formData.name.trim() || isSaving}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md transition-colors",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Group
        </button>
      </div>
    </div>
  );
}

interface GroupCardProps {
  group: FieldGroup;
  isEditing: boolean;
  formData: {
    name: string;
    description: string;
    columns: number;
    layout_type: string;
  };
  setFormData: (data: any) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
  isSaving?: boolean;
  isDeleting?: boolean;
}

function GroupCard({
  group,
  isEditing,
  formData,
  setFormData,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  isSaving = false,
  isDeleting = false,
}: GroupCardProps) {
  return (
    <div
      className={cn("border rounded-lg bg-card transition-all", isEditing && "ring-2 ring-primary")}
    >
      {isEditing ? (
        <div className="p-6">
          <h4 className="text-md font-medium mb-4">Edit Group</h4>
          <GroupForm
            formData={formData}
            setFormData={setFormData}
            onCancel={onCancel}
            onSave={onSave}
            isSaving={isSaving}
          />
        </div>
      ) : (
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              {/* Drag Handle */}
              <div className="mt-1 text-muted-foreground cursor-grab">
                <GripVertical className="h-5 w-5" />
              </div>

              {/* Group Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="text-md font-semibold">{group.name}</h4>
                  <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                    {group.columns} column{group.columns > 1 ? "s" : ""}
                  </span>
                </div>

                {group.description && (
                  <p className="text-sm text-muted-foreground mb-3">{group.description}</p>
                )}

                {/* Layout Preview */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <LayoutGrid className="h-3 w-3" />
                  <span>
                    Layout: <span className="font-medium capitalize">{group.layout_type}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={onEdit}
                disabled={isSaving || isDeleting}
                className="p-2 hover:bg-accent rounded-md transition-colors disabled:opacity-50"
                title="Edit group"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={onDelete}
                disabled={isDeleting}
                className="p-2 hover:bg-destructive/10 text-destructive rounded-md transition-colors disabled:opacity-50"
                title="Delete group"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to get layout type from columns
function getLayoutType(columns: number): string {
  switch (columns) {
    case 1:
      return "single";
    case 2:
      return "two-column";
    case 3:
      return "three-column";
    case 4:
      return "four-column";
    default:
      return "single";
  }
}
