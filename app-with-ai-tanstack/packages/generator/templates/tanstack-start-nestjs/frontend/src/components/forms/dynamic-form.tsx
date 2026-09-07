
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  FileText,
  Hash,
  HelpCircle,
  KeyRound,
  Link2,
  List,
  Lock,
  Mail,
  Phone,
  Table2,
  ToggleLeft,
  Type,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { type FieldMetadata, useEntities, useFormFields, useRefList } from "@/hooks/use-entities";
import { apiClient } from "@/lib/api-client";
import { getFieldTypeColor, getFieldTypeLabel, validateFormData } from "@/lib/field-schema";
import { getFieldLabel } from "@/lib/i18n-fields";
import { useTranslations } from "@/lib/translations";
import { cn, referenceLabel } from "@/lib/utils";
import { format } from "date-fns";

interface DynamicFormProps {
  tableName: string;
  fields?: FieldMetadata[];
  initialData?: Record<string, unknown>;
  onSubmit?: (data: Record<string, unknown>) => void | Promise<void>;
  /** Called whenever any field value changes — useful for parent to track dirty state */
  onChange?: (data: Record<string, unknown>) => void;
  isLoading?: boolean;
  isSaving?: boolean;
  mode?: "create" | "edit" | "view";
  readOnly?: boolean;
  serverErrors?: Record<string, string>;
  parentField?: string;
  readOnlyFields?: string[];
  /** Explicit primary key column name. Defaults to the `bus_<x> → <x>_id`
   *  convention when omitted, which does not hold for dictionary levels
   *  (e.g. table → sys_table_id, column → sys_column_id) — pass level.idField
   *  there so the auto-generated create-mode UUID lands on the real PK column. */
  idField?: string;
  /** Data from the immediate parent record — used to filter lookup dropdowns (e.g. filter columns by parent tab's sys_table_id) */
  parentContext?: Record<string, unknown>;
}

const REFERENCE_TYPE = {
  STRING: 10,
  INTEGER: 11,
  AMOUNT: 12,
  ID: 13,
  TEXT: 14,
  DATE: 15,
  DATETIME: 16,
  LIST: 17,
  TABLE: 18,
  TABLE_DIRECT: 19,
  YES_NO: 20,
  URL: 24,
  EMAIL: 30,
  PHONE: 31,
  PASSWORD: 29,
};

type FormValues = Record<string, unknown>;

function getFieldIcon(sysReferenceId: number) {
  switch (sysReferenceId) {
    case REFERENCE_TYPE.STRING:
      return Type;
    case REFERENCE_TYPE.INTEGER:
      return Hash;
    case REFERENCE_TYPE.AMOUNT:
      return Hash;
    case REFERENCE_TYPE.EMAIL:
      return Mail;
    case REFERENCE_TYPE.URL:
      return Link2;
    case REFERENCE_TYPE.PHONE:
      return Phone;
    case REFERENCE_TYPE.DATE:
    case REFERENCE_TYPE.DATETIME:
      return Calendar;
    case REFERENCE_TYPE.YES_NO:
      return ToggleLeft;
    case REFERENCE_TYPE.TEXT:
      return FileText;
    case REFERENCE_TYPE.PASSWORD:
      return KeyRound;
    case REFERENCE_TYPE.TABLE:
    case REFERENCE_TYPE.TABLE_DIRECT:
      return Table2;
    default:
      return sysReferenceId >= 1000 ? List : Type;
  }
}

function TableReferenceViewValue({ field, id }: { field: FieldMetadata; id: string }) {
  const idField = field.ref_id_field || "id";
  // Honour `ref_label_fields` (a list, so an entity identified by more than
  // one column reads properly) before the single `ref_label_field`. This
  // previously fell back to `ref_endpoint` only, so any FK to a plain
  // business table (ref_table_name, no custom endpoint) never fired the
  // query and always rendered the raw id — see dynamic-table.tsx for the
  // matching fix on the list view.
  const labelFields: string[] = (field as any).ref_label_fields?.length
    ? (field as any).ref_label_fields
    : field.ref_label_field
      ? [field.ref_label_field]
      : ["name"];
  const endpoint =
    field.ref_endpoint || (field.ref_table_name ? `/bus/${field.ref_table_name.replace(/^bus_/, "")}` : null);

  const { data } = useQuery({
    queryKey: ["table-ref-view", endpoint, id],
    queryFn: () => apiClient.get<{ data: any[] }>(endpoint!, { limit: 500 }),
    enabled: !!endpoint && !!id,
  });

  const records = (data as any)?.data ?? [];
  const record = records.find((r: any) => String(r[idField]) === String(id));
  if (!record) return <span>{id}</span>;
  return <span>{referenceLabel(record, labelFields, id)}</span>;
}

interface TableReferenceFieldProps {
  field: FieldMetadata;
  fieldApi: any;
  form: any;
  isDisabled: boolean;
  error: string | undefined;
  parentContext?: Record<string, unknown>;
}

function TableReferenceField({
  field,
  fieldApi,
  form,
  isDisabled,
  error,
  parentContext,
}: TableReferenceFieldProps) {
  const referencedTableName = field.ref_table_name || null;
  const idField = field.ref_id_field || "id";
  const labelFields: string[] = (field as any).ref_label_fields?.length
    ? (field as any).ref_label_fields
    : field.ref_label_field
      ? [field.ref_label_field]
      : ["name"];

  // Subscribe to the parent field's value for cascading selects
  const formFilterValue = form.useStore((state: any) =>
    field.ref_filter_source ? state.values[field.ref_filter_source] : undefined,
  );
  const filterValue =
    formFilterValue !== undefined
      ? formFilterValue
      : field.ref_filter_source && parentContext
        ? parentContext[field.ref_filter_source]
        : undefined;

  const prevFilterValue = useRef(filterValue);
  useEffect(() => {
    if (prevFilterValue.current !== undefined && prevFilterValue.current !== filterValue) {
      fieldApi.handleChange("");
    }
    prevFilterValue.current = filterValue;
  }, [filterValue]);

  // Resolve filtered endpoint: append ref_filter_param=<parentContext[ref_filter_source]> when configured
  const customEndpoint = field.ref_endpoint
    ? field.ref_filter_param && filterValue != null
      ? `${field.ref_endpoint}?${field.ref_filter_param}=${encodeURIComponent(String(filterValue))}`
      : field.ref_endpoint
    : null;

  // Custom endpoint (e.g. /sys/references) — use apiClient directly
  const { data: customData, isLoading: isLoadingCustom } = useQuery({
    queryKey: ["table-ref-custom", customEndpoint],
    queryFn: () => apiClient.get<{ data: any[] }>(customEndpoint!, { limit: 500 }),
    enabled: !!customEndpoint,
  });

  // Standard business table endpoint — pass cascading filter when configured
  const entityFilterParams =
    !customEndpoint && field.ref_filter_param && filterValue != null
      ? { [field.ref_filter_param]: `equals:${filterValue}` }
      : undefined;

  const { data: records, isLoading: isLoadingRecords } = useEntities<any>(
    referencedTableName || "",
    entityFilterParams,
    {
      enabled: !!referencedTableName && !customEndpoint && (!field.ref_filter_param || filterValue != null),
    }
  );

  const isLoading = isLoadingCustom || isLoadingRecords;
  const tableRecords: any[] = customEndpoint
    ? ((customData as any)?.data ?? [])
    : (records?.data ?? []);

  if (!referencedTableName && !customEndpoint) {
    return (
      <Input
        id={field.column_name}
        name={field.column_name}
        value={(fieldApi.state.value as string) || ""}
        onChange={(e) => fieldApi.handleChange(e.target.value)}
        onBlur={fieldApi.handleBlur}
        disabled={isDisabled}
        className={cn(error && "border-destructive")}
      />
    );
  }

  const currentValue = fieldApi.state.value;
  const awaitingParent = !!field.ref_filter_param && filterValue == null;

  return isLoading ? (
    <Skeleton className="h-10 w-full" />
  ) : (
    <select
      id={field.column_name}
      name={field.column_name}
      value={currentValue !== undefined && currentValue !== null ? String(currentValue) : ""}
      onChange={(e) => {
        const raw = e.target.value;
        // Preserve numeric IDs for sys_reference_id etc.
        const parsed = raw !== "" && !isNaN(Number(raw)) ? Number(raw) : raw;
        fieldApi.handleChange(parsed || raw);
      }}
      onBlur={fieldApi.handleBlur}
      disabled={isDisabled || awaitingParent}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        error && "border-destructive"
      )}
    >
      <option value="">
        {awaitingParent
          ? `Select ${field.ref_filter_source?.replace(/_id$/, "").replace(/_/g, " ")} first...`
          : `Select ${field.name}...`}
      </option>
      {tableRecords.map((record: any) => {
        const optValue = record[idField];
        const optLabel = referenceLabel(record, labelFields, String(optValue));
        return (
          <option key={String(optValue)} value={String(optValue)}>
            {optLabel}
          </option>
        );
      })}
    </select>
  );
}

function FieldTypeBadge({ field }: { field: FieldMetadata }) {
  const Icon = getFieldIcon(field.sys_reference_id);
  const typeLabel = getFieldTypeLabel(field.sys_reference_id);
  const colorClass = getFieldTypeColor(field.sys_reference_id);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        colorClass
      )}
    >
      <Icon className="w-3 h-3" />
      {typeLabel}
    </span>
  );
}

function FieldHelpPopover({ help, fieldName }: { help: string; fieldName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
        aria-label={`Help for ${fieldName}`}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-5 z-50 w-64 rounded-lg border border-border bg-popover shadow-lg p-3 text-popover-foreground">
            <div className="flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="leading-relaxed text-xs whitespace-pre-wrap">{help}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FieldConstraints({ field, charCount }: { field: FieldMetadata; charCount?: number }) {
  const hints: string[] = [];
  if (field.field_length && field.sys_reference_id !== REFERENCE_TYPE.YES_NO) {
    hints.push(`max ${field.field_length}`);
  }
  if (field.sys_reference_id === REFERENCE_TYPE.PASSWORD) {
    hints.push("min 6");
  }

  if (hints.length === 0 && charCount === undefined) return null;

  return (
    <div className="flex items-center justify-between mt-1">
      {hints.length > 0 && (
        <span className="text-[10px] text-muted-foreground">{hints.join(" · ")}</span>
      )}
      {charCount !== undefined && field.field_length && (
        <span
          className={cn(
            "text-[10px] font-mono",
            charCount > field.field_length
              ? "text-destructive font-semibold"
              : charCount > field.field_length * 0.8
                ? "text-amber-500"
                : "text-muted-foreground"
          )}
        >
          {charCount}/{field.field_length}
        </span>
      )}
    </div>
  );
}

interface FieldRendererProps {
  field: FieldMetadata;
  form: ReturnType<typeof useForm<FormValues>>;
  serverErrors?: Record<string, string>;
  zodErrors?: Record<string, string>;
  tableName: string;
  readOnlyFields?: string[];
  parentContext?: Record<string, unknown>;
}

function FieldRenderer({
  field,
  form,
  serverErrors = {},
  zodErrors = {},
  tableName,
  readOnlyFields = [],
  parentContext,
}: FieldRendererProps) {
  const isFormReadOnly = (form as any).readOnly || false;
  const formMode = (form as any).mode || "edit";
  const fieldLabel = getFieldLabel(tableName, (field as any).tab_name, field.name, field.name);
  const isDisabled =
    (field.is_read_only && formMode !== "create") || readOnlyFields.includes(field.column_name);
  const isReadOnly = isDisabled || isFormReadOnly;

  const { data: refListValues, isLoading: isLoadingRefList } = useRefList(
    field.sys_reference_id >= 1000 ? field.sys_reference_id : 0
  );

  return (
    <form.Field
      name={field.column_name}
      validators={{
        onChange: ({ value }: { value: unknown }) => {
          if (field.is_mandatory && !value) return `${fieldLabel} is required`;
          if (
            field.field_length &&
            typeof value === "string" &&
            value.length > field.field_length
          ) {
            return `${fieldLabel} must be at most ${field.field_length} characters`;
          }
          return undefined;
        },
      }}
    >
      {(fieldApi: any) => {
        const clientError = fieldApi.state.meta.errors?.[0] as string | undefined;
        const serverError = serverErrors?.[field.column_name];
        const zodError = zodErrors?.[field.column_name];
        const error = clientError || serverError || zodError;
        const currentValue = fieldApi.state.value;
        const charCount = typeof currentValue === "string" ? currentValue.length : undefined;

        const labelBlock = (
          <div className="flex items-center gap-2 mb-1.5">
            <Label
              htmlFor={field.column_name}
              className={cn("text-sm font-medium", error && "text-destructive")}
            >
              {fieldLabel}
              {field.is_mandatory && <span className="text-red-500 ml-0.5">*</span>}
            </Label>
            <FieldTypeBadge field={field} />
            {isDisabled && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                <Lock className="w-2.5 h-2.5" /> Read-only
              </span>
            )}
            {field.help && <FieldHelpPopover help={field.help} fieldName={fieldLabel} />}
          </div>
        );

        const errorBlock = error && (
          <div className="flex items-center gap-1 mt-1.5 text-destructive">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <p className="text-xs">{error}</p>
          </div>
        );

        const inputStyles = cn(
          error && "border-destructive ring-destructive/20",
          isDisabled && "bg-muted/50 cursor-not-allowed",
          field.is_mandatory && !error && "border-primary/30"
        );

        // ── VIEW MODE: render clean plain text, no inputs ──────────────
        const isRefField = field.sys_reference_id === 18 || field.sys_reference_id === 19;
        if (formMode === "view") {
          // TABLE/TABLE_DIRECT refs: show label lookup or "—"
          if (isRefField) {
            return (
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-medium text-muted-foreground">{fieldLabel}</span>
                  {field.is_mandatory && <span className="text-red-400 text-xs">*</span>}
                  {field.help && <FieldHelpPopover help={field.help} fieldName={fieldLabel} />}
                </div>
                <div className="text-sm text-foreground font-medium min-h-[1.25rem]">
                  {!currentValue || currentValue === "" ? (
                    <span className="text-muted-foreground/60 italic">—</span>
                  ) : (
                    <TableReferenceViewValue field={field} id={String(currentValue)} />
                  )}
                </div>
              </div>
            );
          }

          const displayValue = (() => {
            if (currentValue === null || currentValue === undefined || currentValue === "")
              return "—";
            if (typeof currentValue === "boolean") return currentValue ? "Yes" : "No";
            // Same formats the grid uses (see components/tables/dynamic-table.tsx).
            // `toLocaleDateString` rendered 15 January 2000 as "1/15/2000" here
            // and "15/01/2000" one screen earlier, because it follows whichever
            // locale the runtime happens to hold — which also differs between
            // the SSR pass and the browser.
            if (field.sys_reference_id === 15) {
              // DATE — show date only, no time component
              const d = new Date(String(currentValue));
              return isNaN(d.getTime()) ? String(currentValue) : format(d, "dd/MM/yyyy");
            }
            if (field.sys_reference_id === 16) {
              // DATETIME — show date and time
              const d = new Date(String(currentValue));
              return isNaN(d.getTime()) ? String(currentValue) : format(d, "dd/MM/yyyy HH:mm:ss");
            }
            if (field.options && field.options.length > 0) {
              // Enum — look up the label so "female" shows as "Female"
              const matched = field.options.find((o) => o.value === String(currentValue));
              return matched ? matched.label : String(currentValue);
            }
            return String(currentValue);
          })();

          return (
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-xs font-medium text-muted-foreground">{fieldLabel}</span>
                {field.is_mandatory && <span className="text-red-400 text-xs">*</span>}
                {field.help && <FieldHelpPopover help={field.help} fieldName={fieldLabel} />}
              </div>
              <div className="text-sm text-foreground font-medium min-h-[1.25rem]">
                {displayValue}
              </div>
            </div>
          );
        }

        // Static options list (inline enum — no DB fetch required)
        if (field.options && field.options.length > 0) {
          return (
            <div>
              {labelBlock}
              <select
                id={field.column_name}
                name={field.column_name}
                value={(currentValue as string) || ""}
                onChange={(e) => fieldApi.handleChange(e.target.value)}
                onBlur={fieldApi.handleBlur}
                disabled={isReadOnly}
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                  inputStyles
                )}
              >
                <option value="">Select {fieldLabel}...</option>
                {field.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {errorBlock}
            </div>
          );
        }

        // Reference list dropdown
        if (field.sys_reference_id >= 1000) {
          return (
            <div>
              {labelBlock}
              {isLoadingRefList ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <select
                  id={field.column_name}
                  name={field.column_name}
                  value={(currentValue as string) || ""}
                  onChange={(e) => fieldApi.handleChange(e.target.value)}
                  onBlur={fieldApi.handleBlur}
                  disabled={isReadOnly}
                  className={cn(
                    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                    inputStyles
                  )}
                >
                  <option value="">Select {fieldLabel}...</option>
                  {refListValues?.map((refValue) => (
                    <option key={refValue.sys_ref_list_id} value={refValue.value}>
                      {refValue.name}
                    </option>
                  ))}
                </select>
              )}
              {errorBlock}
            </div>
          );
        }

        // Table or Table Direct reference
        if (
          field.sys_reference_id === REFERENCE_TYPE.TABLE ||
          field.sys_reference_id === REFERENCE_TYPE.TABLE_DIRECT
        ) {
          return (
            <div>
              {labelBlock}
              <TableReferenceField
                field={field}
                fieldApi={fieldApi}
                form={form}
                isDisabled={isReadOnly}
                error={error}
                parentContext={parentContext}
              />
              {errorBlock}
            </div>
          );
        }

        switch (field.sys_reference_id) {
          case REFERENCE_TYPE.TEXT:
            return (
              <div>
                {labelBlock}
                <Textarea
                  id={field.column_name}
                  name={field.column_name}
                  value={(currentValue as string) || ""}
                  onChange={(e) => fieldApi.handleChange(e.target.value)}
                  onBlur={fieldApi.handleBlur}
                  disabled={isReadOnly}
                  className={cn(inputStyles)}
                  rows={4}
                />
                <FieldConstraints field={field} charCount={charCount} />
                {errorBlock}
              </div>
            );

          case REFERENCE_TYPE.YES_NO:
            // The required marker and the error block are here rather than in
            // `labelBlock` because this control lays its own label out beside
            // the box. Leaving them off made a mandatory boolean the one field
            // that could fail validation and say nothing about it.
            return (
              <div className="pt-6">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={field.column_name}
                    checked={(currentValue as boolean) || false}
                    onCheckedChange={(checked) => fieldApi.handleChange(checked)}
                    disabled={isReadOnly}
                    className={cn(field.is_mandatory && "border-primary/50")}
                  />
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={field.column_name}
                      className={cn("text-sm", error && "text-destructive")}
                    >
                      {fieldLabel}
                      {field.is_mandatory && <span className="text-red-500 ml-0.5">*</span>}
                    </Label>
                    <FieldTypeBadge field={field} />
                  </div>
                </div>
                {errorBlock}
              </div>
            );

          case REFERENCE_TYPE.DATE:
            return (
              <div>
                {labelBlock}
                <Input
                  id={field.column_name}
                  name={field.column_name}
                  type="date"
                  value={(currentValue as string)?.split("T")[0] || ""}
                  onChange={(e) => fieldApi.handleChange(e.target.value)}
                  onBlur={fieldApi.handleBlur}
                  disabled={isReadOnly}
                  className={cn(inputStyles)}
                />
                {errorBlock}
              </div>
            );

          case REFERENCE_TYPE.DATETIME:
            return (
              <div>
                {labelBlock}
                <Input
                  id={field.column_name}
                  name={field.column_name}
                  type="datetime-local"
                  value={(currentValue as string)?.slice(0, 16) || ""}
                  onChange={(e) => fieldApi.handleChange(e.target.value)}
                  onBlur={fieldApi.handleBlur}
                  disabled={isReadOnly}
                  className={cn(inputStyles)}
                />
                {errorBlock}
              </div>
            );

          case REFERENCE_TYPE.INTEGER:
          case REFERENCE_TYPE.AMOUNT:
            return (
              <div>
                {labelBlock}
                <Input
                  id={field.column_name}
                  name={field.column_name}
                  type="number"
                  step={field.sys_reference_id === REFERENCE_TYPE.AMOUNT ? "0.01" : "1"}
                  value={(currentValue as number) ?? ""}
                  onChange={(e) => fieldApi.handleChange(e.target.valueAsNumber || null)}
                  onBlur={fieldApi.handleBlur}
                  disabled={isReadOnly}
                  className={cn(inputStyles)}
                />
                {errorBlock}
              </div>
            );

          case REFERENCE_TYPE.EMAIL:
            return (
              <div>
                {labelBlock}
                <Input
                  id={field.column_name}
                  name={field.column_name}
                  type="email"
                  value={(currentValue as string) || ""}
                  onChange={(e) => fieldApi.handleChange(e.target.value)}
                  onBlur={fieldApi.handleBlur}
                  disabled={isReadOnly}
                  className={cn(inputStyles)}
                />
                <FieldConstraints field={field} charCount={charCount} />
                {errorBlock}
              </div>
            );

          case REFERENCE_TYPE.URL:
            return (
              <div>
                {labelBlock}
                <Input
                  id={field.column_name}
                  name={field.column_name}
                  type="url"
                  value={(currentValue as string) || ""}
                  onChange={(e) => fieldApi.handleChange(e.target.value)}
                  onBlur={fieldApi.handleBlur}
                  disabled={isReadOnly}
                  className={cn(inputStyles)}
                  placeholder="https://..."
                />
                <FieldConstraints field={field} charCount={charCount} />
                {errorBlock}
              </div>
            );

          case REFERENCE_TYPE.PHONE:
            return (
              <div>
                {labelBlock}
                <Input
                  id={field.column_name}
                  name={field.column_name}
                  type="tel"
                  value={(currentValue as string) || ""}
                  onChange={(e) => fieldApi.handleChange(e.target.value)}
                  onBlur={fieldApi.handleBlur}
                  disabled={isReadOnly}
                  className={cn(inputStyles)}
                />
                <FieldConstraints field={field} charCount={charCount} />
                {errorBlock}
              </div>
            );

          case REFERENCE_TYPE.PASSWORD:
            return (
              <div>
                {labelBlock}
                <Input
                  id={field.column_name}
                  name={field.column_name}
                  type="password"
                  value={(currentValue as string) || ""}
                  onChange={(e) => fieldApi.handleChange(e.target.value)}
                  onBlur={fieldApi.handleBlur}
                  disabled={isReadOnly}
                  className={cn(inputStyles)}
                />
                <FieldConstraints field={field} charCount={charCount} />
                {errorBlock}
              </div>
            );

          default:
            return (
              <div>
                {labelBlock}
                <Input
                  id={field.column_name}
                  name={field.column_name}
                  type="text"
                  value={(currentValue as string) || ""}
                  onChange={(e) => fieldApi.handleChange(e.target.value)}
                  onBlur={fieldApi.handleBlur}
                  disabled={isReadOnly}
                  maxLength={field.field_length}
                  className={cn(inputStyles)}
                />
                <FieldConstraints field={field} charCount={charCount} />
                {errorBlock}
              </div>
            );
        }
      }}
    </form.Field>
  );
}

/** Subscribes to form value changes and notifies the parent via onChange.
 *  Skips the initial render so the parent isn't notified with the initial data. */
function FormChangeNotifier({
  form,
  onChange,
}: {
  form: ReturnType<typeof useForm<FormValues>>;
  onChange: (data: Record<string, unknown>) => void;
}) {
  const values = form.useStore((state: any) => state.values);
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    onChange(values);
  }, [values]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function DynamicForm({
  tableName,
  fields: externalFields,
  initialData = {},
  onSubmit,
  onChange,
  isLoading: externalLoading = false,
  isSaving = false,
  mode = "create",
  readOnly = false,
  serverErrors = {},
  parentField,
  readOnlyFields = [],
  parentContext,
  idField,
}: DynamicFormProps) {
  const { t } = useTranslations();
  const {
    data: fetchedFields,
    isLoading: fieldsLoading,
    error,
  } = useFormFields(tableName, { enabled: !externalFields });
  const fields = externalFields || fetchedFields;
  const [zodErrors, setZodErrors] = useState<Record<string, string>>({});

  // Derive the entity PK column name from the table name (bus_patient → patient_id),
  // unless the caller knows the real PK (dictionary levels don't follow that convention).
  const pkColumnName = idField ?? tableName.replace(/^bus_/, "") + "_id";

  const form = useForm<FormValues>({
    defaultValues: initialData,
    onSubmit: async ({ value }) => {
      if (readOnly || !onSubmit) return;

      // Auto-generate UUID for the entity PK in create mode
      if (mode === "create" && fields && !value[pkColumnName]) {
        value[pkColumnName] = crypto.randomUUID();
      }

      // Zod validation
      if (fields) {
        const displayedFields = fields.filter((f) => {
          if (!f.is_displayed || f.column_name === parentField) return false;
          if (mode === "create" && f.column_name === pkColumnName) return false;
          return true;
        });
        const validation = validateFormData(
          displayedFields,
          value,
          mode === "view" ? "edit" : mode
        );
        if (!validation.success) {
          setZodErrors(validation.errors);
          toast.error("Please fix the validation errors");
          return;
        }
        setZodErrors({});
      }

      const filteredValues =
        mode === "edit" && fields
          ? Object.entries(value).reduce(
              (acc, [key, val]) => {
                if (
                  key === "id" ||
                  key === "created_at" ||
                  key === "updated_at" ||
                  key === "deleted_at"
                )
                  return acc;
                const field = fields.find((f: FieldMetadata) => f.column_name === key);
                const isUpdateable = field?.is_updateable !== false;
                const isVersionField = key === "version";
                if (isUpdateable || isVersionField) acc[key] = val;
                return acc;
              },
              {} as Record<string, unknown>
            )
          : value;

      await onSubmit(filteredValues);
    },
  });

  (form as any).readOnly = readOnly;
  (form as any).mode = mode;

  useEffect(() => {
    if (Object.keys(initialData).length > 0) {
      Object.entries(initialData).forEach(([key, value]) => {
        form.setFieldValue(key, value);
      });
    }
  }, [initialData]);

  /*
   * A drawn checkbox has an answer.
   *
   * A Yes/No field starts undefined, and the control renders `undefined` as
   * unticked — so the form showed an answered "No" that the validator counted
   * as unanswered, and a create was refused with "Please fix the validation
   * errors" and nothing beside any field. Every entity in the dance-studio
   * model with a mandatory boolean — Room, Instructor, Member — could not be
   * created from the interface at all, though the API accepted the same
   * payload. Seed the value the control is already showing.
   */
  useEffect(() => {
    if (mode !== "create" || !fields) return;
    for (const field of fields) {
      if (field.sys_reference_id !== REFERENCE_TYPE.YES_NO) continue;
      if (!field.is_displayed || field.column_name === parentField) continue;
      if (form.getFieldValue(field.column_name as never) === undefined) {
        form.setFieldValue(field.column_name as never, false as never);
      }
    }
  }, [fields, mode, parentField]);

  const isLoading = externalFields ? false : fieldsLoading;

  const groupedFields = useMemo(() => {
    if (!fields || fields.length === 0) return new Map();
    const displayFields = fields.filter((f) => {
      if (!f.is_displayed || f.column_name === parentField) return false;
      // Hide the entity's own PK field in create mode — it's auto-generated on submit
      if (mode === "create" && f.column_name === pkColumnName) return false;
      return true;
    });
    const groups: Map<string | null, FieldMetadata[]> = new Map();
    displayFields.forEach((field) => {
      const groupName = field.group_name || null;
      if (!groups.has(groupName)) groups.set(groupName, []);
      groups.get(groupName)!.push(field);
    });
    return groups;
  }, [fields, parentField]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (error && !externalFields) {
    return (
      <div className="rounded-md bg-destructive/15 p-4 text-destructive">
        Failed to load form fields: {error.message}
      </div>
    );
  }

  if (!fields || fields.length === 0) {
    return (
      <div className="rounded-md bg-muted p-4 text-muted-foreground">
        No fields configured for this entity.
      </div>
    );
  }

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (readOnly || !onSubmit) return;

    const currentValues = form.state.values;
    const value = currentValues as Record<string, unknown>;

    // Auto-generate UUID for the entity PK in create mode
    if (mode === "create" && fields && !value[pkColumnName]) {
      value[pkColumnName] = crypto.randomUUID();
    }

    // Zod validation
    if (fields) {
      const displayedFields = fields.filter((f) => {
        if (!f.is_displayed || f.column_name === parentField) return false;
        if (mode === "create" && f.column_name === pkColumnName) return false;
        return true;
      });
      const validation = validateFormData(displayedFields, value, mode === "view" ? "edit" : mode);
      if (!validation.success) {
        setZodErrors(validation.errors);
        toast.error("Please fix the validation errors");
        return;
      }
      setZodErrors({});
    }

    const filteredValues =
      mode === "edit" && fields
        ? Object.entries(value).reduce(
            (acc, [key, val]) => {
              if (
                key === "id" ||
                key === "created_at" ||
                key === "updated_at" ||
                key === "deleted_at"
              )
                return acc;
              const field = fields.find((f: FieldMetadata) => f.column_name === key);
              const isUpdateable = !field?.is_read_only;
              const isVersionField = key === "version";
              if (isUpdateable || isVersionField) acc[key] = val;
              return acc;
            },
            {} as Record<string, unknown>
          )
        : value;

    await onSubmit(filteredValues);
  };

  const requiredCount = fields.filter((f) => {
    if (!f.is_displayed || !f.is_mandatory || f.column_name === parentField) return false;
    if (mode === "create" && f.column_name === pkColumnName) return false;
    return true;
  }).length;
  const totalDisplayed = fields.filter((f) => {
    if (!f.is_displayed || f.column_name === parentField) return false;
    if (mode === "create" && f.column_name === pkColumnName) return false;
    return true;
  }).length;

  return (
    <form.Provider>
      {onChange && <FormChangeNotifier form={form} onChange={onChange} />}
      <form role="form" onSubmit={handleFormSubmit} className="space-y-6">
        {/* Form summary bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{totalDisplayed} fields</span>
            {requiredCount > 0 && (
              <>
                <span className="text-muted-foreground/30">|</span>
                <span className="text-xs text-red-500/80 font-medium">
                  {requiredCount} required
                </span>
              </>
            )}
            {Object.keys(zodErrors).length > 0 && (
              <>
                <span className="text-muted-foreground/30">|</span>
                <span className="inline-flex items-center gap-1 text-xs text-destructive font-medium">
                  <AlertCircle className="w-3 h-3" />
                  {Object.keys(zodErrors).length} validation{" "}
                  {Object.keys(zodErrors).length === 1 ? "error" : "errors"}
                </span>
              </>
            )}
          </div>
          {!readOnly && onSubmit && (
            <form.Subscribe selector={(state: any) => [state.isSubmitting]}>
              {([isFormSubmitting]: any) => (
                <Button
                  type="submit"
                  disabled={isSaving || isFormSubmitting}
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                >
                  {isSaving || isFormSubmitting
                    ? "Saving..."
                    : mode === "create"
                      ? "Create"
                      : "Save"}
                </Button>
              )}
            </form.Subscribe>
          )}
        </div>

        {Array.from(groupedFields.entries()).map(([groupName, fieldsInGroup]) => {
          const groupColumns = fieldsInGroup[0]?.group_columns || 1;

          return (
            <div key={groupName || "ungrouped"} className="space-y-4">
              {groupName && (
                <div className="border-b border-primary/20 pb-2">
                  <h3 className="text-sm font-semibold text-primary">{groupName}</h3>
                  {fieldsInGroup[0]?.group_description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {fieldsInGroup[0].group_description}
                    </p>
                  )}
                </div>
              )}

              <div
                className={cn(
                  "grid gap-x-6 gap-y-5",
                  groupColumns === 1 && "grid-cols-1",
                  groupColumns === 2 && "grid-cols-1 md:grid-cols-2",
                  groupColumns === 3 && "grid-cols-1 md:grid-cols-3",
                  groupColumns === 4 && "grid-cols-1 md:grid-cols-4"
                )}
              >
                {fieldsInGroup.map((field: FieldMetadata) => (
                  <div
                    key={field.sys_field_id}
                    className={cn(
                      field.col_span &&
                        field.col_span > 1 &&
                        `md:col-span-${Math.min(groupColumns, field.col_span)}`
                    )}
                  >
                    <FieldRenderer
                      field={field}
                      form={form}
                      serverErrors={serverErrors}
                      zodErrors={zodErrors}
                      tableName={tableName}
                      readOnlyFields={
                        mode === "edit" ? [...readOnlyFields, pkColumnName] : readOnlyFields
                      }
                      parentContext={parentContext}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {!readOnly && onSubmit && (
          <div className="flex justify-end gap-4 pt-2 border-t border-border">
            <form.Subscribe selector={(state: any) => [state.isSubmitting]}>
              {([isFormSubmitting]: any) => (
                <Button
                  type="submit"
                  disabled={isSaving || isFormSubmitting}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isSaving || isFormSubmitting
                    ? "Saving..."
                    : mode === "create"
                      ? "Create"
                      : "Save"}
                </Button>
              )}
            </form.Subscribe>
          </div>
        )}
      </form>
    </form.Provider>
  );
}
