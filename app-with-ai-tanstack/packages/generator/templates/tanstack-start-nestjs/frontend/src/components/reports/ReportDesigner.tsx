import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

interface ReportDesignerProps {
  tableName: string;
  /** Column names available in this entity for the data-source tree */
  columns: string[];
  onSaved?: () => void;
}

export function ReportDesigner({ tableName, columns, onSaved }: ReportDesignerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const el = containerRef.current;
    let instance: { dispose?: () => void } | undefined;

    const dataSource = columns.map((col) => ({ label: col, field: col }));

    import("ankareport").then((module) => {
      const AnkaReport = (module as any).default ?? module;

      const loadAndInit = async () => {
        let existingLayout: object | undefined;
        try {
          const design = await apiClient.get<{ layout?: object } | null>(`/sys/report-designs/${tableName}`);
          existingLayout = design?.layout ?? undefined;
        } catch {
          // no existing design — start empty
        }

        instance = AnkaReport.designer({
          element: el,
          dataSource,
          layout: existingLayout,
          onSaveButtonClick: async (layout: object) => {
            setIsSaving(true);
            try {
              await apiClient.put(`/sys/report-designs/${tableName}`, { layout });
              toast.success("Report design saved");
              onSaved?.();
            } catch (err: any) {
              toast.error(err?.message ?? "Failed to save report design");
            } finally {
              setIsSaving(false);
            }
          },
        });
      };

      loadAndInit();
    }).catch((err) => {
      console.error("Failed to load ankareport:", err);
    });

    return () => {
      if (instance && typeof (instance as any).dispose === "function") {
        (instance as any).dispose();
      }
      // Remove all child nodes without setting innerHTML
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }
    };
  }, [tableName, columns, onSaved]);

  return (
    <div className="flex flex-col h-full">
      {isSaving && (
        <div className="px-4 py-2 text-sm text-muted-foreground border-b border-border">
          Saving report design…
        </div>
      )}
      <div ref={containerRef} className="flex-1 w-full" style={{ minHeight: 600 }} />
    </div>
  );
}
