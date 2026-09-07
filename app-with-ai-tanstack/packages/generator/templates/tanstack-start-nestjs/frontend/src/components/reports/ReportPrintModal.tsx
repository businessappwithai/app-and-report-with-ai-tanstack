import { useEffect, useRef } from "react";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReportPrintModalProps {
  open: boolean;
  onClose: () => void;
  layout: object;
  /** The record data to render into the report */
  data: Record<string, unknown>;
  entityLabel?: string;
}

export function ReportPrintModal({
  open,
  onClose,
  layout,
  data,
  entityLabel,
}: ReportPrintModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<{ exportToPdf?: (name: string) => void; exportToXlsx?: (name: string) => void } | null>(null);

  useEffect(() => {
    if (!open || !containerRef.current) return;

    const el = containerRef.current;

    import("ankareport").then((module) => {
      const AnkaReport = (module as any).default ?? module;
      rendererRef.current = AnkaReport.render({
        element: el,
        layout,
        data: { ...data, records: [data] },
      });
    }).catch((err) => {
      console.error("Failed to load ankareport renderer:", err);
    });

    return () => {
      rendererRef.current = null;
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }
    };
  }, [open, layout, data]);

  const handleExportPdf = () => {
    rendererRef.current?.exportToPdf?.(`${entityLabel ?? "report"}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex flex-row items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <DialogTitle className="text-base font-semibold">
            {entityLabel ? `Print — ${entityLabel}` : "Print Report"}
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleExportPdf}>
              <Printer className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-auto p-6">
          <div ref={containerRef} className="w-full" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
