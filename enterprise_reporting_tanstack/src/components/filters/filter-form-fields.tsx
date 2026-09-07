import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FilterFieldType, FilterOperator } from "@/types/database";

interface SavedQuery {
  id: string;
  name: string;
  sql_content: string;
  data_source_id: string;
}

interface AvailableField {
  name: string;
  type: string;
}

export interface FilterFormData {
  name: string;
  description: string;
  query_id: string;
  data_source_id: string;
  filter_query: string;
  display_field: string[];
  value_field: string;
  field_type: FilterFieldType;
  operator: FilterOperator;
  max_from_date: string;
  min_to_date: string;
}

interface FilterFormFieldsProps {
  formData: FilterFormData;
  onFormDataChange: (data: FilterFormData) => void;
  savedQueries: SavedQuery[] | undefined;
  availableFields: AvailableField[];
  isLoadingFields: boolean;
  onQueryChange: (queryId: string) => void;
  idPrefix?: string;
}

export function FilterFormFields({
  formData,
  onFormDataChange,
  savedQueries,
  availableFields,
  isLoadingFields,
  onQueryChange,
  idPrefix = "",
}: FilterFormFieldsProps) {
  const set = (patch: Partial<FilterFormData>) => onFormDataChange({ ...formData, ...patch });

  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}name`}>Filter Name</Label>
        <Input
          id={`${idPrefix}name`}
          value={formData.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="e.g., Customer Filter"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}description`}>Description</Label>
        <Textarea
          id={`${idPrefix}description`}
          value={formData.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="Optional description"
          rows={2}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}field_type`}>Field Type</Label>
        <Select
          value={formData.field_type}
          onValueChange={(value: FilterFieldType) =>
            set({
              field_type: value,
              operator:
                value === "id"
                  ? "in"
                  : value === "date"
                    ? "between"
                    : value === "number"
                      ? "equals"
                      : "contains",
            })
          }
        >
          <SelectTrigger id={`${idPrefix}field_type`}>
            <SelectValue placeholder="Select field type..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="id">ID (Dropdown from query)</SelectItem>
            <SelectItem value="number">Number (Comparison operators)</SelectItem>
            <SelectItem value="date">Date (Date range)</SelectItem>
            <SelectItem value="text">Text (Pattern matching)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-tremor-label text-tremor-content">
          {formData.field_type === "id" && "Select a query to populate dropdown options in filter"}
          {formData.field_type === "number" && "Select a query to filter by numeric column"}
          {formData.field_type === "date" && "Select a query to filter by date column"}
          {formData.field_type === "text" && "Select a query to filter by text column"}
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}query_id`}>Saved Query *</Label>
        <Select value={formData.query_id} onValueChange={onQueryChange}>
          <SelectTrigger id={`${idPrefix}query_id`}>
            <SelectValue placeholder="Select a saved query..." />
          </SelectTrigger>
          <SelectContent>
            {savedQueries?.map((query) => (
              <SelectItem key={query.id} value={query.id}>
                {query.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-tremor-label text-tremor-content">
          Select a saved query to populate available columns
        </p>
      </div>

      {formData.field_type === "id" && (
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Display Fields (Multiple)</Label>
            {isLoadingFields ? (
              <p className="text-tremor-label text-tremor-content">Loading fields...</p>
            ) : availableFields.length > 0 ? (
              <MultiSelect
                options={availableFields.map((f) => ({ label: f.name, value: f.name }))}
                value={formData.display_field}
                onValueChange={(values) => set({ display_field: values })}
                placeholder="Select display fields..."
                className="w-full"
              />
            ) : (
              <Input
                value={formData.display_field.join(", ")}
                onChange={(e) =>
                  set({
                    display_field: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="e.g., firstName, lastName"
              />
            )}
            <p className="text-tremor-label text-tremor-content">
              Select multiple fields to display
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Value Field</Label>
            {isLoadingFields ? (
              <p className="text-tremor-label text-tremor-content">Loading fields...</p>
            ) : availableFields.length > 0 ? (
              <Select
                value={formData.value_field}
                onValueChange={(value) => set({ value_field: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field..." />
                </SelectTrigger>
                <SelectContent>
                  {availableFields.map((field) => (
                    <SelectItem key={field.name} value={field.name}>
                      {field.name} ({field.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={formData.value_field}
                onChange={(e) => set({ value_field: e.target.value })}
                placeholder="e.g., id"
              />
            )}
            <p className="text-tremor-label text-tremor-content">
              Field used for filtering (should be unique)
            </p>
          </div>
        </div>
      )}

      {formData.field_type === "number" && (
        <>
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}operator`}>Operator</Label>
            <Select
              value={formData.operator}
              onValueChange={(value: FilterOperator) => set({ operator: value })}
            >
              <SelectTrigger id={`${idPrefix}operator`}>
                <SelectValue placeholder="Select operator..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">Equals (=)</SelectItem>
                <SelectItem value="less_than">Less Than (&lt;)</SelectItem>
                <SelectItem value="less_than_equal">Less Than or Equal (&lt;=)</SelectItem>
                <SelectItem value="greater_than">Greater Than (&gt;)</SelectItem>
                <SelectItem value="greater_than_equal">Greater Than or Equal (&gt;=)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}value_field`}>Numeric Column *</Label>
            {isLoadingFields ? (
              <p className="text-tremor-label text-tremor-content">
                Loading fields... Please select a saved query first.
              </p>
            ) : availableFields.length > 0 ? (
              <Select
                value={formData.value_field}
                onValueChange={(value) => set({ value_field: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select numeric column..." />
                </SelectTrigger>
                <SelectContent>
                  {availableFields
                    .filter((f) => {
                      const type = (f.type || "").toLowerCase();
                      return (
                        type.includes("int") ||
                        type.includes("number") ||
                        type.includes("decimal") ||
                        type.includes("numeric") ||
                        type.includes("real") ||
                        type.includes("double") ||
                        type.includes("float") ||
                        type.includes("bigint") ||
                        type.includes("smallint") ||
                        type.includes("tinyint")
                      );
                    })
                    .map((field) => (
                      <SelectItem key={field.name} value={field.name}>
                        {field.name} ({field.type})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-xs text-amber-800">
                  Please select a saved query above to load available numeric columns.
                </p>
              </div>
            )}
            <p className="text-tremor-label text-tremor-content">
              The numeric database column to filter on
            </p>
          </div>
        </>
      )}

      {formData.field_type === "date" && (
        <>
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}date-operator`}>Operator</Label>
            <Select
              value={formData.operator}
              onValueChange={(value: FilterOperator) => set({ operator: value })}
            >
              <SelectTrigger id={`${idPrefix}date-operator`}>
                <SelectValue placeholder="Select operator..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="between">Between (Date Range)</SelectItem>
                <SelectItem value="equals">Equals (=)</SelectItem>
                <SelectItem value="less_than">Before (&lt;)</SelectItem>
                <SelectItem value="greater_than">After (&gt;)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}date-column`}>Date Column</Label>
            {isLoadingFields ? (
              <p className="text-tremor-label text-tremor-content">Loading fields...</p>
            ) : availableFields.length > 0 ? (
              <Select
                value={formData.value_field}
                onValueChange={(value) => set({ value_field: value })}
              >
                <SelectTrigger id={`${idPrefix}date-column`}>
                  <SelectValue placeholder="Select date column..." />
                </SelectTrigger>
                <SelectContent>
                  {availableFields
                    .filter((f) => {
                      const type = (f.type || "").toLowerCase();
                      return (
                        type.includes("date") || type.includes("time") || type.includes("timestamp")
                      );
                    })
                    .map((field) => (
                      <SelectItem key={field.name} value={field.name}>
                        {field.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={formData.value_field}
                onChange={(e) => set({ value_field: e.target.value })}
                placeholder="e.g., created_at, order_date"
              />
            )}
            <p className="text-tremor-label text-tremor-content">
              The database date column to filter on
            </p>
          </div>
          {formData.operator === "between" && (
            <div className="border rounded-md p-3 bg-muted/50">
              <Label className="text-sm font-medium">Date Validation (Optional)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Limit the date range users can select
              </p>
              <div className="grid gap-2">
                <div>
                  <Label htmlFor={`${idPrefix}max_from_date`} className="text-xs">
                    From Date Must Be Before/Equal To
                  </Label>
                  <Input
                    id={`${idPrefix}max_from_date`}
                    type="date"
                    value={formData.max_from_date}
                    onChange={(e) => set({ max_from_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor={`${idPrefix}min_to_date`} className="text-xs">
                    To Date Must Be After/Equal To
                  </Label>
                  <Input
                    id={`${idPrefix}min_to_date`}
                    type="date"
                    value={formData.min_to_date}
                    onChange={(e) => set({ min_to_date: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {formData.field_type === "text" && (
        <>
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}text-operator`}>Operator</Label>
            <Select
              value={formData.operator}
              onValueChange={(value: FilterOperator) => set({ operator: value })}
            >
              <SelectTrigger id={`${idPrefix}text-operator`}>
                <SelectValue placeholder="Select operator..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contains</SelectItem>
                <SelectItem value="starts_with">Starts With</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}text-column`}>Text Column</Label>
            {isLoadingFields ? (
              <p className="text-tremor-label text-tremor-content">Loading fields...</p>
            ) : availableFields.length > 0 ? (
              <Select
                value={formData.value_field}
                onValueChange={(value) => set({ value_field: value })}
              >
                <SelectTrigger id={`${idPrefix}text-column`}>
                  <SelectValue placeholder="Select text column..." />
                </SelectTrigger>
                <SelectContent>
                  {availableFields
                    .filter((f) => {
                      const type = (f.type || "").toLowerCase();
                      const isTextType =
                        type.includes("text") ||
                        type.includes("char") ||
                        type.includes("varchar") ||
                        type.includes("string");
                      const isUnknownType = type === "";
                      const isNonText =
                        type.includes("int") ||
                        type.includes("number") ||
                        type.includes("decimal") ||
                        type.includes("numeric") ||
                        type.includes("real") ||
                        type.includes("double") ||
                        type.includes("float") ||
                        type.includes("date") ||
                        type.includes("time") ||
                        type.includes("bool");
                      return (isTextType || isUnknownType) && !isNonText;
                    })
                    .map((field) => (
                      <SelectItem key={field.name} value={field.name}>
                        {field.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={formData.value_field}
                onChange={(e) => set({ value_field: e.target.value })}
                placeholder="e.g., customer_name, email"
              />
            )}
            <p className="text-tremor-label text-tremor-content">
              The database text column to search in
            </p>
          </div>
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Performance Warning</p>
              <p className="text-xs">
                Text filters (contains, starts with) prevent index usage and will result in slow
                queries on large datasets.
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
