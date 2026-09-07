/**
 * Entity Metadata Form Component
 *
 * Form for editing entity metadata (description, is_active, is_hidden).
 * Uses TanStack Form with Zod validation.
 */

import { useForm } from "@tanstack/react-form";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const entityMetadataSchema = z.object({
  description: z.string().max(5000, "Description must not exceed 5000 characters").optional(),
  is_active: z.boolean(),
  is_hidden: z.boolean(),
});

export type EntityMetadataFormValues = z.infer<typeof entityMetadataSchema>;

interface EntityMetadataFormProps {
  entityId: string;
  entityName: string;
  initialDescription?: string;
  initialIsActive?: boolean;
  initialIsHidden?: boolean;
  onSubmit: (data: EntityMetadataFormValues) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function EntityMetadataForm({
  entityId: _entityId,
  entityName,
  initialDescription = "",
  initialIsActive = false,
  initialIsHidden = true,
  onSubmit,
  onCancel,
  isLoading = false,
}: EntityMetadataFormProps) {
  const form = useForm({
    defaultValues: {
      description: initialDescription,
      is_active: initialIsActive,
      is_hidden: initialIsHidden,
    },
    onSubmit: async ({ value }) => {
      entityMetadataSchema.parse(value);
      await onSubmit(value);
    },
  });

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Entity Metadata: {entityName}</CardTitle>
        <CardDescription>
          Configure metadata settings for this entity. Only description, active status, and
          visibility can be modified.
        </CardDescription>
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
                  .max(5000, "Description must not exceed 5000 characters")
                  .optional()
                  .safeParse(value);
                return result.success ? undefined : result.error.issues[0]?.message;
              },
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Description</Label>
                <Textarea
                  id={field.name}
                  placeholder="Enter a description for this entity..."
                  className="min-h-[100px] resize-y"
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                <p className="text-tremor-default text-tremor-content">
                  A human-readable description of what this entity represents. Max 5000 characters.
                </p>
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
                )}
              </div>
            )}
          </form.Field>

          {/* Is Active Field */}
          <form.Field name="is_active">
            {(field) => (
              <div className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <Checkbox
                  id="is_active"
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(checked as boolean)}
                />
                <div className="space-y-1 leading-none">
                  <Label htmlFor="is_active">Active</Label>
                  <p className="text-tremor-default text-tremor-content">
                    When enabled, this entity will be visible and accessible in the system. Entities
                    are inactive by default.
                  </p>
                </div>
              </div>
            )}
          </form.Field>

          {/* Is Hidden Field */}
          <form.Field name="is_hidden">
            {(field) => (
              <div className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <Checkbox
                  id="is_hidden"
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(checked as boolean)}
                />
                <div className="space-y-1 leading-none">
                  <Label htmlFor="is_hidden">Hidden</Label>
                  <p className="text-tremor-default text-tremor-content">
                    When enabled, this entity will be hidden from standard views. Hidden entities
                    are still accessible via direct links or API.
                  </p>
                </div>
              </div>
            )}
          </form.Field>

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
