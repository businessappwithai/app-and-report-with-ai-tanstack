
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Columns,
  Eye,
  EyeOff,
  GripVertical,
  Layers,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  type FieldMetadata,
  useAllFormFields,
  useAllGridFields,
  useFieldGroups,
} from "@/hooks/use-entities";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────── types */

interface WorkingField extends FieldMetadata {
  originalGroupId: string | null;
  originalSeqNo: number;
  dirty: boolean;
}

interface WorkingGroup {
  id: string; // 'unassigned' | actual sys_field_group_id
  name: string;
  columns: number;
  description: string;
  layout_type: string; // 'single' | 'summary'
  seq_no: number;
  isNew: boolean;
  isEditing: boolean;
  isDeleted: boolean;
  fields: WorkingField[];
}

const FIELD_TYPE_LABELS: Record<number, string> = {
  10: "String",
  11: "Integer",
  12: "Amount",
  13: "ID",
  14: "Text",
  15: "Date",
  16: "DateTime",
  17: "List",
  18: "Table Ref",
  19: "Direct Ref",
  20: "Boolean",
  24: "URL",
  30: "Email",
  31: "Phone",
};

/* ─────────────────────────────────────────────────────────── helpers */

function buildGroupedState(
  fields: FieldMetadata[],
  groups: {
    sys_field_group_id: string;
    name: string;
    columns: number;
    description?: string;
    layout_type?: string;
    seq_no: number;
  }[]
): WorkingGroup[] {
  const groupMap = new Map<string, WorkingGroup>();

  // Create group entries
  for (const g of groups) {
    groupMap.set(g.sys_field_group_id, {
      id: g.sys_field_group_id,
      name: g.name,
      columns: g.columns,
      description: g.description ?? "",
      layout_type: g.layout_type ?? "single",
      seq_no: g.seq_no ?? 0,
      isNew: false,
      isEditing: false,
      isDeleted: false,
      fields: [],
    });
  }

  // Unassigned bucket
  groupMap.set("unassigned", {
    id: "unassigned",
    name: "Unassigned Fields",
    columns: 1,
    description: "Fields not yet assigned to a group",
    layout_type: "single",
    seq_no: 9999,
    isNew: false,
    isEditing: false,
    isDeleted: false,
    fields: [],
  });

  // Place fields into groups
  for (const f of fields) {
    const groupId = f.field_group_id ?? "unassigned";
    const target = groupMap.get(groupId) ?? groupMap.get("unassigned")!;
    target.fields.push({
      ...f,
      originalGroupId: f.field_group_id ?? null,
      originalSeqNo: f.seq_no,
      dirty: false,
    });
  }

  // Sort fields by seq_no within each group
  groupMap.forEach((g) => {
    g.fields.sort((a: WorkingField, b: WorkingField) => a.seq_no - b.seq_no);
  });

  const arr: WorkingGroup[] = [];
  groupMap.forEach((v) => arr.push(v));
  return arr.sort((a: WorkingGroup, b: WorkingGroup) => a.seq_no - b.seq_no);
}

/* ─────────────────────────────────────────────────────────── FieldCard */

function FieldCard({
  field,
  index,
  groupId,
  onToggleVisibility,
}: {
  field: WorkingField;
  index: number;
  groupId: string;
  onToggleVisibility: (fieldId: string, groupId: string) => void;
}) {
  const typeLabel =
    FIELD_TYPE_LABELS[field.sys_reference_id] ??
    field.reference_name ??
    String(field.sys_reference_id);

  return (
    <Draggable draggableId={field.sys_field_id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...(provided.draggableProps as any)}
          className={cn(
            "flex items-center gap-2 px-3 py-2.5 rounded-md border text-sm transition-all",
            snapshot.isDragging
              ? "bg-primary/5 border-primary/40 shadow-lg ring-1 ring-primary/20"
              : field.dirty
                ? "bg-amber-50 border-amber-200"
                : "bg-white border-border hover:border-primary/30 hover:bg-muted/20",
            !field.is_displayed && "opacity-50"
          )}
        >
          {/* Drag handle */}
          <span
            {...provided.dragHandleProps}
            className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing flex-shrink-0"
          >
            <GripVertical className="h-4 w-4" />
          </span>

          {/* Field info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-foreground truncate">{field.name}</span>
              {field.is_mandatory && <span className="text-red-500 text-xs font-bold">*</span>}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-muted-foreground font-mono">
                {field.column_name}
              </span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1 py-0">
                {typeLabel}
              </Badge>
              {field.is_read_only && (
                <Badge
                  variant="outline"
                  className="text-[10px] h-4 px-1 py-0 text-muted-foreground"
                >
                  Read-only
                </Badge>
              )}
            </div>
          </div>

          {/* Visibility toggle */}
          <button
            onClick={() => onToggleVisibility(field.sys_field_id, groupId)}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            title={field.is_displayed ? "Hide field" : "Show field"}
          >
            {field.is_displayed ? (
              <Eye className="h-3.5 w-3.5 text-primary/70" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      )}
    </Draggable>
  );
}

/* ─────────────────────────────────────────────────────────── GroupPanel */

function GroupPanel({
  group,
  onEditToggle,
  onEditSave,
  onEditCancel,
  onDelete,
  onToggleVisibility,
  onToggleSummary,
}: {
  group: WorkingGroup;
  onEditToggle: (id: string) => void;
  onEditSave: (id: string, name: string, columns: number, description: string) => void;
  onEditCancel: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleVisibility: (fieldId: string, groupId: string) => void;
  onToggleSummary: (id: string) => void;
}) {
  const [editName, setEditName] = useState(group.name);
  const [editCols, setEditCols] = useState(group.columns);
  const [editDesc, setEditDesc] = useState(group.description);

  useEffect(() => {
    if (group.isEditing) {
      setEditName(group.name);
      setEditCols(group.columns);
      setEditDesc(group.description);
    }
  }, [group.isEditing, group.name, group.columns, group.description]);

  const isUnassigned = group.id === "unassigned";
  const isSummary = group.layout_type === "summary";

  const colsLabel = group.columns === 1 ? "1 column" : `${group.columns} columns`;

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border shadow-sm",
        isUnassigned
          ? "border-dashed border-muted-foreground/30 bg-muted/20"
          : isSummary
            ? "border-amber-300 bg-amber-50/50 shadow-amber-100"
            : "border-border bg-card",
        group.isNew && "ring-2 ring-primary/40"
      )}
    >
      {/* Group header */}
      <div
        className={cn(
          "px-4 py-3 rounded-t-xl border-b",
          isUnassigned
            ? "border-muted-foreground/20 bg-muted/30"
            : isSummary
              ? "border-amber-200 bg-amber-100/60"
              : "border-border bg-muted/30"
        )}
      >
        {group.isEditing ? (
          /* Inline edit form */
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Group name"
                className="h-7 text-sm font-semibold"
                autoFocus
              />
              <button
                onClick={() => onEditSave(group.id, editName, editCols, editDesc)}
                className="text-emerald-600 hover:text-emerald-700 flex-shrink-0"
                title="Save"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => onEditCancel(group.id)}
                className="text-muted-foreground hover:text-foreground flex-shrink-0"
                title="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Input
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Description (optional)"
              className="h-7 text-xs"
            />
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Columns:</Label>
              {[1, 2, 3, 4].map((c) => (
                <button
                  key={c}
                  onClick={() => setEditCols(c)}
                  className={cn(
                    "w-7 h-7 rounded text-xs font-semibold border transition-colors",
                    editCols === c
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:border-primary/50"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Normal header */
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {isSummary ? (
                  <Star className="h-4 w-4 text-amber-500 flex-shrink-0" />
                ) : (
                  <Layers className="h-4 w-4 text-primary/60 flex-shrink-0" />
                )}
                <span className="font-semibold text-sm text-foreground truncate">{group.name}</span>
                {!isUnassigned && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px] h-4 px-1.5 flex-shrink-0",
                      isSummary && "bg-amber-100 text-amber-700 border-amber-200"
                    )}
                  >
                    {isSummary ? (
                      <>
                        <Star className="h-2.5 w-2.5 mr-0.5" />
                        Summary
                      </>
                    ) : (
                      <>
                        <Columns className="h-2.5 w-2.5 mr-0.5" />
                        {colsLabel}
                      </>
                    )}
                  </Badge>
                )}
              </div>
              {group.description && !isUnassigned && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{group.description}</p>
              )}
            </div>
            {!isUnassigned && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onToggleSummary(group.id)}
                  className={cn(
                    "p-1 transition-colors rounded",
                    isSummary
                      ? "text-amber-500 hover:text-amber-600"
                      : "text-muted-foreground hover:text-amber-500"
                  )}
                  title={isSummary ? "Remove from Summary" : "Mark as Summary section"}
                >
                  <Star className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onEditToggle(group.id)}
                  className="p-1 text-muted-foreground hover:text-primary transition-colors rounded"
                  title="Edit group"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onDelete(group.id)}
                  className="p-1 text-muted-foreground hover:text-red-500 transition-colors rounded"
                  title="Delete group"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Droppable fields area */}
      <Droppable droppableId={group.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex-1 p-3 space-y-1.5 min-h-[80px] rounded-b-xl transition-colors",
              snapshot.isDraggingOver && "bg-primary/5",
              group.fields.length === 0 && "flex items-center justify-center"
            )}
          >
            {group.fields.length === 0 && !snapshot.isDraggingOver && (
              <p className="text-xs text-muted-foreground/50 text-center py-2">
                {isUnassigned ? "All fields assigned" : "Drop fields here"}
              </p>
            )}
            {group.fields.map((field, index) => (
              <FieldCard
                key={field.sys_field_id}
                field={field}
                index={index}
                groupId={group.id}
                onToggleVisibility={onToggleVisibility}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── main component */

interface UnifiedFieldLayoutProps {
  entityName: string;
  onEntityChange?: (name: string) => void;
}

export function UnifiedFieldLayout({ entityName }: UnifiedFieldLayoutProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"form" | "grid">("form");
  const [groups, setGroups] = useState<WorkingGroup[]>([]);
  const [gridList, setGridList] = useState<WorkingField[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { data: fieldGroupsData, isLoading: groupsLoading } = useFieldGroups(entityName);
  const { data: formFields, isLoading: formLoading } = useAllFormFields(entityName);
  const { data: gridFields, isLoading: gridLoading } = useAllGridFields(entityName);

  const isLoading = groupsLoading || (mode === "form" ? formLoading : gridLoading);

  // Build form working state (grouped)
  useEffect(() => {
    if (mode !== "form" || !formFields || !fieldGroupsData) return;
    const g = buildGroupedState(formFields, fieldGroupsData as any[]);
    setGroups(g);
    setIsDirty(false);
  }, [formFields, fieldGroupsData, mode]);

  // Build grid working state (flat list, ordered by seq_no_grid)
  useEffect(() => {
    if (mode !== "grid" || !gridFields) return;
    const sorted = [...(gridFields as any[])].sort(
      (a, b) =>
        ((a as any).seq_no_grid ?? a.seq_no ?? 999) - ((b as any).seq_no_grid ?? b.seq_no ?? 999)
    );
    setGridList(
      sorted.map((f: any) => ({
        ...f,
        seq_no: f.seq_no_grid ?? f.seq_no ?? 0,
        is_displayed: f.is_displayed_grid ?? f.is_displayed ?? false,
        originalGroupId: null,
        originalSeqNo: f.seq_no_grid ?? f.seq_no ?? 0,
        dirty: false,
      }))
    );
    setIsDirty(false);
  }, [gridFields, mode]);

  /* ── drag end */
  const onDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId && source.index === destination.index)
      return;

    setGroups((prev) => {
      const next = prev.map((g) => ({ ...g, fields: [...g.fields] }));
      const srcGroup = next.find((g) => g.id === source.droppableId)!;
      const dstGroup = next.find((g) => g.id === destination.droppableId)!;

      const [movedField] = srcGroup.fields.splice(source.index, 1);

      const newGroupId = destination.droppableId === "unassigned" ? null : destination.droppableId;
      const updatedField: WorkingField = {
        ...movedField,
        field_group_id: newGroupId ?? undefined,
        dirty:
          newGroupId !== movedField.originalGroupId ||
          source.droppableId !== destination.droppableId,
      };

      dstGroup.fields.splice(destination.index, 0, updatedField);

      // Recalculate seq_no within destination group
      dstGroup.fields = dstGroup.fields.map((f, i) => ({
        ...f,
        seq_no: (i + 1) * 10,
        dirty: f.dirty || f.seq_no !== (i + 1) * 10,
      }));

      return next;
    });
    setIsDirty(true);
  }, []);

  /* ── toggle visibility */
  const handleToggleVisibility = useCallback((fieldId: string, groupId: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          fields: g.fields.map((f) =>
            f.sys_field_id === fieldId ? { ...f, is_displayed: !f.is_displayed, dirty: true } : f
          ),
        };
      })
    );
    setIsDirty(true);
  }, []);

  /* ── group editing */
  const handleEditToggle = useCallback((id: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === id ? { ...g, isEditing: !g.isEditing } : { ...g, isEditing: false }
      )
    );
  }, []);

  const handleEditSave = useCallback(
    (id: string, name: string, columns: number, description: string) => {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === id
            ? ({ ...g, name, columns, description, isEditing: false, dirty: true } as any)
            : g
        )
      );
      setIsDirty(true);
    },
    []
  );

  const handleEditCancel = useCallback((id: string) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, isEditing: false } : g)));
  }, []);

  const handleDeleteGroup = useCallback((id: string) => {
    setGroups((prev) => {
      const groupToDelete = prev.find((g) => g.id === id);
      if (!groupToDelete) return prev;
      // Move fields from deleted group to unassigned
      const movedFields = groupToDelete.fields.map((f) => ({
        ...f,
        field_group_id: undefined,
        dirty: true,
      }));
      return prev
        .filter((g) => g.id !== id)
        .map((g) => (g.id === "unassigned" ? { ...g, fields: [...g.fields, ...movedFields] } : g));
    });
    setIsDirty(true);
  }, []);

  /* ── toggle summary */
  const handleToggleSummary = useCallback((id: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === id
          ? ({
              ...g,
              layout_type: g.layout_type === "summary" ? "single" : "summary",
              dirty: true,
            } as any)
          : g
      )
    );
    setIsDirty(true);
  }, []);

  /* ── add group */
  const handleAddGroup = useCallback(() => {
    const tempId = `new-${Date.now()}`;
    const newGroup: WorkingGroup = {
      id: tempId,
      name: "New Group",
      columns: 2,
      description: "",
      layout_type: "single",
      seq_no: (groups.filter((g) => g.id !== "unassigned").length + 1) * 10,
      isNew: true,
      isEditing: true,
      isDeleted: false,
      fields: [],
    };
    // Insert before unassigned
    setGroups((prev) => {
      const idx = prev.findIndex((g) => g.id === "unassigned");
      const next = [...prev];
      next.splice(idx, 0, newGroup);
      return next;
    });
    setIsDirty(true);
  }, [groups]);

  /* ── grid mode: drag-to-reorder flat list */
  const onGridDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const { source, destination } = result;
    if (source.index === destination.index) return;
    setGridList((prev) => {
      const next = [...prev];
      const [moved] = next.splice(source.index, 1);
      next.splice(destination.index, 0, moved);
      return next.map((f, i) => ({
        ...f,
        seq_no: (i + 1) * 10,
        dirty: f.dirty || f.originalSeqNo !== (i + 1) * 10,
      }));
    });
    setIsDirty(true);
  }, []);

  /* ── grid mode: visibility toggle */
  const handleGridToggleVisibility = useCallback((fieldId: string) => {
    setGridList((prev) =>
      prev.map((f) =>
        f.sys_field_id === fieldId ? { ...f, is_displayed: !f.is_displayed, dirty: true } : f
      )
    );
    setIsDirty(true);
  }, []);

  /* ── save all */
  const handleSaveAll = useCallback(async () => {
    setIsSaving(true);
    try {
      // Grid mode: save seq_no_grid and is_displayed_grid only
      if (mode === "grid") {
        const dirty = gridList.filter((f) => f.dirty);
        await Promise.all(
          dirty.map((f) =>
            apiClient.put(`/sys/fields/${f.sys_field_id}`, {
              seq_no_grid: f.seq_no,
              is_displayed_grid: f.is_displayed,
            })
          )
        );
        await queryClient.invalidateQueries({ queryKey: ["fields-all", entityName, "grid"] });
        toast.success("Grid layout saved successfully");
        setIsDirty(false);
        return;
      }

      // Form mode: save group assignments, seq_no, and is_displayed
      const fieldUpdates: Array<{
        id: string;
        sys_field_group_id: string | null;
        seq_no: number;
        is_displayed: boolean;
      }> = [];
      const groupCreates: WorkingGroup[] = [];
      const groupUpdates: WorkingGroup[] = [];

      for (const g of groups) {
        if (g.id === "unassigned") continue;
        if (g.isNew) {
          groupCreates.push(g);
        } else if ((g as any).dirty) {
          groupUpdates.push(g);
        }
        for (const f of g.fields) {
          if (f.dirty) {
            fieldUpdates.push({
              id: f.sys_field_id,
              sys_field_group_id: g.id === "unassigned" ? null : g.id,
              seq_no: f.seq_no,
              is_displayed: f.is_displayed,
            });
          }
        }
      }

      const unassigned = groups.find((g) => g.id === "unassigned");
      if (unassigned) {
        for (const f of unassigned.fields) {
          if (f.dirty) {
            fieldUpdates.push({
              id: f.sys_field_id,
              sys_field_group_id: null,
              seq_no: f.seq_no,
              is_displayed: f.is_displayed,
            });
          }
        }
      }

      const tempToRealId = new Map<string, string>();
      for (const g of groupCreates) {
        const created = await apiClient.post(`/sys/field-groups?entity=${entityName}`, {
          name: g.name,
          columns: g.columns,
          description: g.description,
          layout_type: g.layout_type ?? "single",
          seq_no: g.seq_no,
        });
        const realId = (created as any)?.sys_field_group_id;
        if (realId) tempToRealId.set(g.id, realId);
      }

      // Remap temp IDs to real UUIDs returned from the server
      for (const update of fieldUpdates) {
        if (update.sys_field_group_id && tempToRealId.has(update.sys_field_group_id)) {
          update.sys_field_group_id = tempToRealId.get(update.sys_field_group_id)!;
        }
      }

      for (const g of groupUpdates) {
        await apiClient.put(`/sys/field-groups/${g.id}?entity=${entityName}`, {
          name: g.name,
          columns: g.columns,
          description: g.description,
          layout_type: g.layout_type ?? "single",
          seq_no: g.seq_no,
        });
      }

      await Promise.all(
        fieldUpdates.map(({ id, ...data }) => apiClient.put(`/sys/fields/${id}`, data))
      );

      await queryClient.invalidateQueries({ queryKey: ["field-groups", entityName] });
      await queryClient.invalidateQueries({ queryKey: ["fields-all", entityName] });

      toast.success("Layout saved successfully");
      setIsDirty(false);
    } catch (err: any) {
      toast.error(`Save failed: ${err.message ?? "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  }, [mode, groups, gridList, entityName, queryClient]);

  /* ── reset */
  const handleReset = useCallback(() => {
    if (mode === "grid") {
      if (!gridFields) return;
      const sorted = [...(gridFields as any[])].sort(
        (a, b) =>
          ((a as any).seq_no_grid ?? a.seq_no ?? 999) - ((b as any).seq_no_grid ?? b.seq_no ?? 999)
      );
      setGridList(
        sorted.map((f: any) => ({
          ...f,
          seq_no: f.seq_no_grid ?? f.seq_no ?? 0,
          is_displayed: f.is_displayed_grid ?? f.is_displayed ?? false,
          originalGroupId: null,
          originalSeqNo: f.seq_no_grid ?? f.seq_no ?? 0,
          dirty: false,
        }))
      );
    } else {
      if (!formFields || !fieldGroupsData) return;
      setGroups(buildGroupedState(formFields, fieldGroupsData as any[]));
    }
    setIsDirty(false);
  }, [mode, gridFields, formFields, fieldGroupsData]);

  /* ── computed stats */
  const dirtyFieldCount = useMemo(
    () =>
      mode === "grid"
        ? gridList.filter((f) => f.dirty).length
        : groups.flatMap((g) => g.fields).filter((f) => f.dirty).length,
    [mode, groups, gridList]
  );

  const visibleGroups = groups.filter((g) => g.id !== "unassigned");
  const unassignedGroup = groups.find((g) => g.id === "unassigned");

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setMode("form")}
              className={cn(
                "px-4 py-1.5 text-sm font-medium transition-colors",
                mode === "form"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              Form Fields
            </button>
            <button
              onClick={() => setMode("grid")}
              className={cn(
                "px-4 py-1.5 text-sm font-medium transition-colors border-l border-border",
                mode === "grid"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              Grid Fields
            </button>
          </div>
          {isDirty && (
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
              {dirtyFieldCount} unsaved change{dirtyFieldCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!isDirty}
            className="h-8 gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSaveAll}
            disabled={!isDirty || isSaving}
            className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? "Saving…" : "Save Layout"}
          </Button>
        </div>
      </div>

      {mode === "grid" ? (
        /* ── Grid mode: flat reorderable list, no groups ── */
        <DragDropContext onDragEnd={onGridDragEnd}>
          <Droppable droppableId="grid-fields">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex flex-col gap-1.5 max-w-xl"
              >
                {gridList.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">No fields found.</p>
                )}
                {gridList.map((field, index) => (
                  <Draggable
                    key={field.sys_field_id}
                    draggableId={field.sys_field_id}
                    index={index}
                  >
                    {(prov, snap) => (
                      <div
                        ref={prov.innerRef}
                        {...(prov.draggableProps as any)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2.5 rounded-md border text-sm transition-all",
                          snap.isDragging
                            ? "bg-primary/5 border-primary/40 shadow-lg"
                            : field.dirty
                              ? "bg-amber-50 border-amber-200"
                              : "bg-white border-border hover:border-primary/30",
                          !field.is_displayed && "opacity-50"
                        )}
                      >
                        <span
                          {...prov.dragHandleProps}
                          className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing flex-shrink-0"
                        >
                          <GripVertical className="h-4 w-4" />
                        </span>
                        <span className="w-6 text-xs text-muted-foreground font-mono text-center flex-shrink-0">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium truncate">{field.name}</span>
                            {field.is_mandatory && (
                              <span className="text-red-500 text-xs font-bold">*</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {field.column_name}
                            </span>
                            <Badge variant="secondary" className="text-[10px] h-4 px-1 py-0">
                              {FIELD_TYPE_LABELS[field.sys_reference_id] ??
                                field.reference_name ??
                                String(field.sys_reference_id)}
                            </Badge>
                          </div>
                        </div>
                        <button
                          onClick={() => handleGridToggleVisibility(field.sys_field_id)}
                          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                          title={field.is_displayed ? "Hide column" : "Show column"}
                        >
                          {field.is_displayed ? (
                            <Eye className="h-3.5 w-3.5 text-primary/70" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        /* ── Form mode: grouped panels ── */
        <DragDropContext onDragEnd={onDragEnd}>
          {visibleGroups.length > 0 ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleGroups.map((group) => (
                <GroupPanel
                  key={group.id}
                  group={group}
                  onEditToggle={handleEditToggle}
                  onEditSave={handleEditSave}
                  onEditCancel={handleEditCancel}
                  onDelete={handleDeleteGroup}
                  onToggleVisibility={handleToggleVisibility}
                  onToggleSummary={handleToggleSummary}
                />
              ))}

              <button
                onClick={handleAddGroup}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-colors min-h-[120px] p-6 text-primary/70 hover:text-primary"
              >
                <Plus className="h-6 w-6" />
                <span className="text-sm font-medium">Add Group</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <button
                onClick={handleAddGroup}
                className="flex flex-col items-center gap-3 px-8 py-6 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-primary"
              >
                <Plus className="h-8 w-8" />
                <div className="text-center">
                  <p className="font-semibold">No field groups yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create groups to organize fields into multi-column layouts
                  </p>
                </div>
              </button>
            </div>
          )}

          {unassignedGroup && (
            <div className="mt-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground font-medium px-2">
                  Unassigned ({unassignedGroup.fields.length})
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <GroupPanel
                group={unassignedGroup}
                onEditToggle={handleEditToggle}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
                onDelete={handleDeleteGroup}
                onToggleVisibility={handleToggleVisibility}
                onToggleSummary={handleToggleSummary}
              />
            </div>
          )}
        </DragDropContext>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border flex-wrap">
        <span className="flex items-center gap-1.5">
          <GripVertical className="h-3.5 w-3.5" /> Drag to reorder or move between groups
        </span>
        <span className="flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5" /> Toggle field visibility
        </span>
        <span className="flex items-center gap-1.5">
          <Pencil className="h-3.5 w-3.5" /> Edit group name &amp; columns
        </span>
        <span className="flex items-center gap-1.5 text-amber-600">
          <Star className="h-3.5 w-3.5" /> Mark group as Summary (shown in record header)
        </span>
      </div>
    </div>
  );
}
