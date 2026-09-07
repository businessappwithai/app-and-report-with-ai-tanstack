/**
 * Field Metadata Form Component
 *
 * Form for editing field metadata (description, is_display_field, is_searchable, display_order, relationship_ui_type).
 * Uses TanStack Form with Zod validation.
 */

import { useForm } from "@tanstack/react-form";
import { ForeignKeyIcon, Loader2 } from "lucide-react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { MetadataEntityField } from "@/types/database";

const fieldMetadataSchema = z.object({
  description: z.string().max(1000, "Description must not exceed 1000 characters").optional(),
  is_display_field: z.boolean(),
  is_searchable: z.boolean(),
  display_order: z.number().int().min(0).max(10000),
  relationship_ui_type: z.enum(["dropdown", "popup"]).nullable().optional(),
});

export type FieldMetadataFormValues = z.infer<typeof fieldMetadataSchema>;

interface FieldMetadataFormProps {
  field: MetadataEntityField;
  onSubmit: (data: FieldMetadataFormValues) => Promise<void>;
  onCancel?: () => void;
  isLoading?: false;
}

export function FieldMetadataForm({
  field,
  onSubmit,
  onCancel,
  isLoading = false,
}: FieldMetadataFormProps) {
  const isForeignKey = field.is_foreign_key;
  const referencedTableName = field.referenced_table_name;

  const form = useForm({
    defaultValues: {
      description: field.description || "",
      is_display_field: field.is_display_field || false,
      is_searchable: field.is_searchable || false,
      display_order: field.display_order || 0,
      relationship_ui_type: field.relationship_ui_type || null,
    } as FieldMetadataFormValues,
    onSubmit: async ({ value }) => {
      fieldMetadataSchema.parse(value);
      await onSubmit(value);
    },
  });

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Field Metadata: {field.field_name}</span>
          <Badge variant="outline">{field.data_type}</Badge>
          {isForeignKey && (
            <Badge variant="secondary" className="gap-1">
              <ForeignKeyIcon className="h-3 w-3" />
              FK → {referencedTableName}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Configure display and search settings for this field.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="space-y-6"
        >
          {/* Description Field */}
          <form.Field
            name="description"
            validators={{
              onChange: ({ value }) => {
                const result = z
                  .string()
                  .max(1000, "Description must not exceed 1000 characters")
                  .optional()
                  .safeParse(value);
                return result.success ? undefined : result.error.issues[0]?.message;
              },
            }}
          >
            {(fieldApi) => (
              <div className="space-y-2">
                <Label htmlFor={fieldApi.name}>Description</Label>
                <Textarea
                  id={fieldApi.name}
                  placeholder="Enter a description for this field..."
                  className="min-h-[80px] resize-y"
                  value={fieldApi.state.value ?? ""}
                  onChange={(e) => fieldApi.handleChange(e.target.value)}
                  onBlur={fieldApi.handleBlur}
                />
                <p className="text-tremor-default text-tremor-content">
                  A human-readable description of what this field represents. Max 1000 characters.
                </p>
                {fieldApi.state.meta.errors.length > 0 && (
                  <p className="text-sm text-destructive">{fieldApi.state.meta.errors[0]}</p>
                )}
              </div>
            )}
          </form.Field>

          {/* Is Display Field */}
          <form.Field name="is_display_field">
            {(fieldApi) => (
              <div className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <Checkbox
                  id="is_display_field"
                  checked={fieldApi.state.value}
                  onCheckedChange={(checked) => fieldApi.handleChange(checked as boolean)}
                />
                <div className="space-y-1 leading-none">
                  <Label htmlFor="is_display_field">Display Field</Label>
                  <p className="text-tremor-default text-tremor-content">
                    When enabled, this field will be shown in list views and summaries. Typically
                    enabled for name/title fields.
                  </p>
                </div>
              </div>
            )}
          </form.Field>

          {/* Is Searchable */}
          <form.Field name="is_searchable">
            {(fieldApi) => (
              <div className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <Checkbox
                  id="is_searchable"
                  checked={fieldApi.state.value}
                  onCheckedChange={(checked) => fieldApi.handleChange(checked as boolean)}
                />
                <div className="space-y-1 leading-none">
                  <Label htmlFor="is_searchable">Searchable</Label>
                  <p className="text-tremor-default text-tremor-content">
                    When enabled, this field will be included in search functionality. Useful for
                    identifier and name fields.
                  </p>
                </div>
              </div>
            )}
          </form.Field>

          {/* Display Order */}
          <form.Field
            name="display_order"
            validators={{
              onChange: ({ value }) => {
                const result = z.number().int().min(0).max(10000).safeParse(value);
                return result.success ? undefined : result.error.issues[0]?.message;
              },
            }}
          >
            {(fieldApi) => (
              <div className="space-y-2">
                <Label htmlFor={fieldApi.name}>Display Order</Label>
                <Input
                  id={fieldApi.name}
                  type="number"
                  min={0}
                  max={10000}
                  placeholder="0"
                  value={fieldApi.state.value}
                  onChange={(e) => fieldApi.handleChange(parseInt(e.target.value, 10) || 0)}
                  onBlur={fieldApi.handleBlur}
                />
                <p className="text-tremor-default text-tremor-content">
                  Determines the order in which fields are displayed. Lower numbers appear first.
                </p>
                {fieldApi.state.meta.errors.length > 0 && (
                  <p className="text-sm text-destructive">{fieldApi.state.meta.errors[0]}</p>
                )}
              </div>
            )}
          </form.Field>

          {/* Relationship UI Type - Only for foreign keys */}
          {isForeignKey && (
            <form.Field name="relationship_ui_type">
              {(fieldApi) => (
                <div className="space-y-2">
                  <Label htmlFor={fieldApi.name}>Relationship UI Type</Label>
                  <Select
                    onValueChange={(value) =>
                      fieldApi.handleChange(
                        value === "__none__" ? null : (value as "dropdown" | "popup")
                      )
                    }
                    value={fieldApi.state.value ?? "__none__"}
                  >
                    <SelectTrigger id={fieldApi.name}>
                      <SelectValue placeholder="Select UI type for foreign key relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None (Standard Input)</SelectItem>
                      <SelectItem value="dropdown">Dropdown (Select from list)</SelectItem>
                      <SelectItem value="popup">Popup (Searchable table)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-tremor-default text-tremor-content">
                    How the foreign key relationship should be displayed in forms.
                    <br />
                    <strong>Dropdown:</strong> Shows a select dropdown with referenced entity&apos;s
                    display fields.
                    <br />
                    <strong>Popup:</strong> Opens a searchable dialog with server-side paginated
                    table.
                  </p>
                </div>
              )}
            </form.Field>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isLoading || form.state.isSubmitting}>
              {(isLoading || form.state.isSubmitting) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
