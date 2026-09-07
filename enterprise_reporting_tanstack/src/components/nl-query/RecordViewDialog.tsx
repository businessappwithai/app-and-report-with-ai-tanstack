/**
 * RecordViewDialog
 *
 * Shows a single entity record in read-only mode using entity metadata
 * to display field labels, groupings, and types properly.
 */

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { MetadataEntityWithFields } from "@/types/database";

interface RecordViewDialogProps {
  open: boolean;
  onClose: () => void;
  dataSourceId: string;
  entityId: string;
  record: Record<string, unknown>;
  /** Entity metadata — pass if already loaded to avoid a second fetch */
  entityMeta?: MetadataEntityWithFields;
}

function FieldValue({ value, dataType }: { value: unknown; dataType: string }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic text-sm">—</span>;
  }
  if (typeof value === "boolean") {
    return (
      <Badge variant={value ? "success" : "secondary"} className="text-xs">
        {value ? "Yes" : "No"}
      </Badge>
    );
  }
  if (typeof value === "object") {
    return (
      <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-words">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  const str = String(value);
  // Truncate very long text with expansion option
  if (str.length > 300) {
    return (
      <p className="text-sm break-words whitespace-pre-wrap text-muted-foreground font-mono text-xs">
        {str.substring(0, 300)}
        <span className="text-tremor-content">… ({str.length} chars)</span>
      </p>
    );
  }
  // Timestamp / date
  if (dataType.includes("timestamp") || dataType.includes("date")) {
    try {
      return (
        <span className="text-sm">
          {new Date(str).toLocaleString()}
          <span className="text-xs text-muted-foreground ml-2">{str}</span>
        </span>
      );
    } catch {
      // fall through
    }
  }
  return <span className="text-sm break-words">{str}</span>;
}

export function RecordViewDialog({
  open,
  onClose,
  dataSourceId,
  entityId,
  record,
  entityMeta: entityMetaProp,
}: RecordViewDialogProps) {
  const { data: fetchedEntity, isLoading } = useQuery({
    queryKey: ["entity-meta", entityId],
    queryFn: async () => {
      const res = await fetch(`/api/metadata/entities/${entityId}`);
      if (!res.ok) throw new Error("Failed to fetch entity metadata");
      const json = await res.json();
      return (json.data ?? json) as MetadataEntityWithFields;
    },
    enabled: open && !entityMetaProp && !!entityId,
  });

  const entity = entityMetaProp ?? fetchedEntity;
  const fields = entity?.fields ?? [];

  // Group fields by section_name
  const sections = fields.reduce<Record<string, typeof fields>>((acc, f) => {
    const sec = f.section_name || "Details";
    acc[sec] = acc[sec] ? [...acc[sec], f] : [f];
    return acc;
  }, {});

  // If no fields defined, fall back to showing raw row columns
  const fallbackColumns = Object.keys(record);

  // Find display name for the record (first is_display_field or first string value)
  const displayField = fields.find((f) => f.is_display_field);
  const displayValue = displayField ? record[displayField.field_name] : record[fallbackColumns[0]];
  const title = displayValue != null ? String(displayValue) : (entity?.entity_name ?? "Record");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg w-full max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 sm:px-6 pt-4 pb-3 border-b shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg leading-tight truncate">
                {title}
              </DialogTitle>
              {entity && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {entity.entity_name}
                  {entity.entity_type === "view" && (
                    <Badge variant="outline" className="ml-1.5 text-xs py-0">
                      view
                    </Badge>
                  )}
                </p>
              )}
            </div>
            <Button variant="ghost" size="sm" className="shrink-0 h-7 w-7 p-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 space-y-5">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && fields.length === 0 && (
            // Fallback: render raw key/value pairs from the row
            <div className="space-y-3">
              {fallbackColumns.map((col) => (
                <div key={col} className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-0.5 truncate">
                    {col}
                  </span>
                  <FieldValue value={record[col]} dataType="text" />
                </div>
              ))}
            </div>
          )}

          {!isLoading &&
            fields.length > 0 &&
            Object.entries(sections).map(([sectionName, sectionFields], idx) => (
              <div key={sectionName}>
                {idx > 0 && <Separator className="mb-4" />}
                {Object.keys(sections).length > 1 && (
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    {sectionName}
                  </h3>
                )}
                <div className="space-y-3">
                  {sectionFields
                    .sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999))
                    .map((field) => {
                      const val = record[field.field_name];
                      return (
                        <div key={field.id} className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                          <div className="pt-0.5 min-w-0">
                            <span className="text-xs font-medium text-muted-foreground leading-tight block truncate">
                              {field.description || field.field_name}
                            </span>
                            <div className="flex gap-1 mt-0.5 flex-wrap">
                              {field.is_primary_key && (
                                <Badge variant="secondary" className="text-[10px] py-0 px-1">
                                  PK
                                </Badge>
                              )}
                              {field.is_foreign_key && (
                                <Badge variant="outline" className="text-[10px] py-0 px-1">
                                  FK
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <FieldValue value={val} dataType={field.data_type} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
        </div>

        <div className="px-4 sm:px-6 py-3 border-t shrink-0 flex items-center justify-between gap-2">
          <span className="text-tremor-label text-tremor-content">View only</span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
