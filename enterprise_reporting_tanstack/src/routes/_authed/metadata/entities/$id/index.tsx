import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Database, Settings } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BatchFieldEditForm } from "@/components/metadata/forms/BatchFieldEditForm";
import { EntityMetadataForm } from "@/components/metadata/forms/EntityMetadataForm";

interface MetadataEntity {
  id: string;
  data_source_id: string;
  entity_name: string;
  entity_schema?: string;
  entity_type: "table" | "view";
  description?: string;
  schema_metadata: string;
  is_active: boolean;
  is_hidden: boolean;
  last_introspected_at: string;
  created_at: string;
  updated_at: string;
}

interface MetadataField {
  id: string;
  entity_header_id: string;
  field_name: string;
  data_type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  foreign_key_table?: string;
  foreign_key_column?: string;
  default_value?: string;
  description?: string;
  is_display_field: boolean;
  is_searchable: boolean;
  display_order?: number;
  relationship_ui_type?: "dropdown" | "popup" | null;
  created_at: string;
  updated_at: string;
}

export const Route = createFileRoute("/_authed/metadata/entities/$id/")({
  component: EntityDetailPage,
});

function EntityDetailPage() {
  const { id: entityId } = Route.useParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"entity" | "fields">("entity");

  const { data: entity, isLoading: entityLoading } = useQuery({
    queryKey: ["metadata-entity", entityId],
    queryFn: async () => {
      const res = await fetch(`/api/metadata/entities/${entityId}`);
      if (!res.ok) throw new Error("Failed to fetch entity");
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.code || "Failed to fetch entity");
      return json.data as MetadataEntity;
    },
    enabled: !!entityId,
    retry: 1,
  });

  const { data: fields, isLoading: fieldsLoading } = useQuery({
    queryKey: ["metadata-entity-fields", entityId],
    queryFn: async () => {
      const res = await fetch(`/api/metadata/entities/${entityId}/fields`);
      if (!res.ok) throw new Error("Failed to fetch fields");
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.code || "Failed to fetch fields");
      return json.data as MetadataField[];
    },
    enabled: !!entityId,
    retry: 1,
  });

  const updateEntityMutation = useMutation({
    mutationFn: async (data: Partial<MetadataEntity>) => {
      const res = await fetch(`/api/metadata/entities/${entityId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update entity");
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.code || "Failed to update entity");
      return json.data as MetadataEntity;
    },
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["metadata-entity", entityId] });

      // Snapshot previous value
      const previousEntity = queryClient.getQueryData(["metadata-entity", entityId]);

      // Optimistically update to the new value
      queryClient.setQueryData(
        ["metadata-entity", entityId],
        (old: MetadataEntity | undefined) => ({
          ...(old || {}),
          ...newData,
        })
      );

      // Return context with the previous value
      return { previousEntity };
    },
    onSuccess: () => {
      toast.success("Entity metadata saved successfully");
    },
    onError: (_err, _newData, context) => {
      if (context?.previousEntity) {
        queryClient.setQueryData(["metadata-entity", entityId], context.previousEntity);
      }
      toast.error(_err instanceof Error ? _err.message : "Failed to save entity metadata");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["metadata-entity", entityId] });
      queryClient.invalidateQueries({ queryKey: ["metadata-entities"] });
    },
  });

  const updateFieldsMutation = useMutation({
    mutationFn: async (fields: MetadataField[]) => {
      const res = await fetch(`/api/metadata/entities/${entityId}/fields/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: fields }),
      });
      if (!res.ok) throw new Error("Failed to update fields");
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.code || "Failed to update fields");
      return json.data;
    },
    onMutate: async (updatedFields) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["metadata-entity-fields", entityId] });

      // Snapshot previous value
      const previousFields = queryClient.getQueryData(["metadata-entity-fields", entityId]);

      // Optimistically update to the new value
      queryClient.setQueryData(
        ["metadata-entity-fields", entityId],
        (old: MetadataField[] | undefined) => {
          if (!old) return [];
          const oldMap = new Map(old.map((f) => [f.id, f]));
          updatedFields.forEach((f) => {
            oldMap.set(f.id, { ...oldMap.get(f.id), ...f });
          });
          return Array.from(oldMap.values());
        }
      );

      // Return context with the previous value
      return { previousFields };
    },
    onSuccess: (_data, fields) => {
      toast.success(`${fields.length} field${fields.length !== 1 ? "s" : ""} saved successfully`);
    },
    onError: (_err, _newFields, context) => {
      if (context?.previousFields) {
        queryClient.setQueryData(["metadata-entity-fields", entityId], context.previousFields);
      }
      toast.error(_err instanceof Error ? _err.message : "Failed to save field changes");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["metadata-entity-fields", entityId] });
      queryClient.invalidateQueries({ queryKey: ["metadata-entity", entityId] });
    },
  });

  const handleEntitySave = async (data: {
    description?: string;
    is_active: boolean;
    is_hidden: boolean;
  }) => {
    await updateEntityMutation.mutateAsync(data);
  };

  const handleFieldsSave = async (fields: MetadataField[]) => {
    await updateFieldsMutation.mutateAsync(fields);
  };

  if (entityLoading || !entity) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/metadata/entities/" className="p-2 hover:bg-muted rounded-md">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Database className="h-6 w-6 text-muted-foreground" />
            <h1 className="font-semibold text-2xl text-tremor-content-strong">
              {entity.entity_name}
            </h1>
          </div>
          <p className="text-tremor-content">
            {entity.entity_type} {entity.entity_schema && `(${entity.entity_schema})`} •{" "}
            {entity.data_source_id}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("entity")}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === "entity"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Entity Metadata
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("fields")}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === "fields"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Fields ({fields?.length ?? 0})
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "entity" && (
        <div className="max-w-4xl">
          <EntityMetadataForm
            entityId={entity.id}
            entityName={entity.entity_name}
            initialDescription={entity.description}
            initialIsActive={Boolean(entity.is_active)}
            initialIsHidden={Boolean(entity.is_hidden)}
            onSubmit={handleEntitySave}
            isLoading={updateEntityMutation.isPending}
          />
        </div>
      )}

      {activeTab === "fields" && (
        <div className="max-w-6xl">
          {fieldsLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            </div>
          ) : fields && fields.length > 0 ? (
            <BatchFieldEditForm
              fields={fields}
              onSubmit={handleFieldsSave}
              isLoading={updateFieldsMutation.isPending}
            />
          ) : (
            <div className="text-center py-12 border rounded-lg">
              <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No fields found</h3>
              <p className="text-tremor-content">This entity has no fields defined yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
