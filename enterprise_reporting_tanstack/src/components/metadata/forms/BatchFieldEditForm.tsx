/**
 * Batch Field Metadata Edit Form Component
 *
 * Form for editing multiple field metadata records in a single request.
 * Uses local state for change tracking with Zod validation on submit.
 */

import { ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import type { MetadataEntityField } from "@/types/database";

const singleFieldSchema = z.object({
  id: z.string(),
  description: z.string().max(1000).optional(),
  is_display_field: z.boolean().optional(),
  is_searchable: z.boolean().optional(),
  display_order: z.number().int().min(0).max(10000).optional(),
  relationship_ui_type: z.enum(["dropdown", "popup"]).nullable().optional(),
});

export type BatchFieldEditFormValues = z.infer<typeof singleFieldSchema>[];

interface BatchFieldEditFormProps {
  fields: MetadataEntityField[];
  onSubmit: (data: BatchFieldEditFormValues) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function BatchFieldEditForm({
  fields,
  onSubmit,
  onCancel,
  isLoading = false,
}: BatchFieldEditFormProps) {
  const [openFieldIds, setOpenFieldIds] = useState<Set<string>>(new Set());

  // Track changes per field
  const [fieldChanges, setFieldChanges] = useState<Map<string, z.infer<typeof singleFieldSchema>>>(
    new Map()
  );

  const toggleField = (fieldId: string) => {
    const newOpen = new Set(openFieldIds);
    if (newOpen.has(fieldId)) {
      newOpen.delete(fieldId);
    } else {
      newOpen.add(fieldId);
    }
    setOpenFieldIds(newOpen);
  };

  const updateFieldChange = (
    fieldId: string,
    updates: Partial<z.infer<typeof singleFieldSchema>>
  ) => {
    const newChanges = new Map(fieldChanges);
    const existing = newChanges.get(fieldId) || {
      id: fieldId,
      description: undefined,
      is_display_field: undefined,
      is_searchable: undefined,
      display_order: undefined,
      relationship_ui_type: undefined,
    };
    newChanges.set(fieldId, { ...existing, ...updates });
    setFieldChanges(newChanges);
  };

  const handleSubmit = async () => {
    const changesArray = Array.from(fieldChanges.values());
    if (changesArray.length === 0) {
      return;
    }
    await onSubmit(changesArray as BatchFieldEditFormValues);
  };

  const hasChanges = fieldChanges.size > 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Batch Edit Fields</CardTitle>
        <CardDescription>
          Configure display and search settings for multiple fields. Only modified fields will be
          updated.
          {hasChanges && (
            <span className="ml-2 text-primary font-medium">
              ({fieldChanges.size} field{fieldChanges.size > 1 ? "s" : ""} modified)
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {fields.map((field) => {
            const isForeignKey = field.is_foreign_key;
            const isOpen = openFieldIds.has(field.id);
            const changes = fieldChanges.get(field.id);
            const hasFieldChange = !!changes;

            return (
              <Collapsible
                key={field.id}
                open={isOpen}
                onOpenChange={() => toggleField(field.id)}
                className="border rounded-lg"
              >
                <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{field.field_name}</span>
                      <Badge variant="outline" className="text-xs">
                        {field.data_type}
                      </Badge>
                      {isForeignKey && (
                        <Badge variant="secondary" className="text-xs">
                          FK → {field.referenced_table_name}
                        </Badge>
                      )}
                      {hasFieldChange && (
                        <Badge variant="default" className="text-xs">
                          Modified
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-tremor-default text-tremor-content">
                    {changes?.is_display_field !== undefined && (
                      <Badge
                        variant={changes.is_display_field ? "default" : "secondary"}
                        className="mr-1"
                      >
                        {changes.is_display_field ? "Display" : "Not Display"}
                      </Badge>
                    )}
                    {changes?.is_searchable !== undefined && (
                      <Badge variant={changes.is_searchable ? "default" : "secondary"}>
                        {changes.is_searchable ? "Searchable" : "Not Searchable"}
                      </Badge>
                    )}
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent className="border-t p-4 pt-4">
                  <div className="space-y-4">
                    {/* Description */}
                    <div className="space-y-2">
                      <label htmlFor={`desc-${field.id}`} className="text-sm font-medium">
                        Description
                      </label>
                      <Input
                        id={`desc-${field.id}`}
                        placeholder={field.description || "No description"}
                        defaultValue={field.description || ""}
                        onChange={(e) =>
                          updateFieldChange(field.id, {
                            description: e.target.value || undefined,
                            id: field.id,
                          })
                        }
                      />
                    </div>

                    {/* Checkboxes */}
                    <div className="flex flex-wrap gap-6">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`display-${field.id}`}
                          checked={changes?.is_display_field ?? field.is_display_field}
                          onCheckedChange={(checked) =>
                            updateFieldChange(field.id, {
                              is_display_field: checked === true,
                              id: field.id,
                            })
                          }
                        />
                        <label
                          htmlFor={`display-${field.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Display Field
                        </label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`searchable-${field.id}`}
                          checked={changes?.is_searchable ?? field.is_searchable}
                          onCheckedChange={(checked) =>
                            updateFieldChange(field.id, {
                              is_searchable: checked === true,
                              id: field.id,
                            })
                          }
                        />
                        <label
                          htmlFor={`searchable-${field.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Searchable
                        </label>
                      </div>
                    </div>

                    {/* Display Order */}
                    <div className="space-y-2">
                      <label htmlFor={`order-${field.id}`} className="text-sm font-medium">
                        Display Order
                      </label>
                      <Input
                        id={`order-${field.id}`}
                        type="number"
                        min={0}
                        max={10000}
                        defaultValue={field.display_order}
                        onChange={(e) =>
                          updateFieldChange(field.id, {
                            display_order: parseInt(e.target.value, 10) || 0,
                            id: field.id,
                          })
                        }
                      />
                    </div>

                    {/* Relationship UI Type - Only for foreign keys */}
                    {isForeignKey && (
                      <div className="space-y-2">
                        <label htmlFor={`rel-${field.id}`} className="text-sm font-medium">
                          Relationship UI Type
                        </label>
                        <select
                          id={`rel-${field.id}`}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          defaultValue={field.relationship_ui_type || ""}
                          onChange={(e) =>
                            updateFieldChange(field.id, {
                              relationship_ui_type:
                                e.target.value === ""
                                  ? null
                                  : (e.target.value as "dropdown" | "popup"),
                              id: field.id,
                            })
                          }
                        >
                          <option value="">None (Standard Input)</option>
                          <option value="dropdown">Dropdown (Select from list)</option>
                          <option value="popup">Popup (Searchable table)</option>
                        </select>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
          )}
          <Button type="button" onClick={handleSubmit} disabled={isLoading || !hasChanges}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save {fieldChanges.size} Change{fieldChanges.size !== 1 ? "s" : ""}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
