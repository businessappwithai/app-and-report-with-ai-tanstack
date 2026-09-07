import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileText, Home, Plus } from "lucide-react";
import { ADSidebar } from "@/components/admin/ad-sidebar";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsListPage,
});

interface SysTable {
  sys_table_id: number;
  table_name: string;
  name: string;
}

interface ReportDesign {
  id: string;
  table_name: string;
  name: string;
  updated_at: string;
}

function ReportsListPage() {
  const { data: tablesData } = useQuery({
    queryKey: ["sys-tables-for-reports"],
    queryFn: () => apiClient.get<{ data: SysTable[] }>("/sys/tables", { limit: 200 }),
  });

  const { data: designs } = useQuery({
    queryKey: ["report-designs-list"],
    queryFn: () => apiClient.get<ReportDesign[]>("/sys/report-designs"),
  });

  const tables: SysTable[] = tablesData?.data ?? [];
  const designMap = new Map<string, ReportDesign>(
    (designs ?? []).map((d) => [d.table_name, d])
  );

  return (
    <ADSidebar>
      <div className="flex flex-col h-full">
        <header className="border-b border-border bg-card px-8 py-8">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
            <Link
              to="/dashboard"
              className="flex items-center gap-1 hover:text-primary transition-colors"
            >
              <Home className="h-3.5 w-3.5" />
              Dashboard
            </Link>
            <span>/</span>
            <Link to="/admin" className="hover:text-primary transition-colors">
              Admin
            </Link>
            <span>/</span>
            <span className="text-foreground">Report Designs</span>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-foreground font-display flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                Report Designs
              </h1>
              <p className="text-muted-foreground mt-2 max-w-xl">
                Design document reports for each entity. Once designed, users see a Print button when viewing records.
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto px-8 py-8">
          {tables.length === 0 ? (
            <p className="text-muted-foreground">No entity tables found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tables.map((table) => {
                const design = designMap.get(table.table_name);
                return (
                  <Link
                    key={table.sys_table_id}
                    to={`/admin/reports/${table.table_name}` as never}
                    className="group relative rounded-xl border border-border bg-card p-6 hover:border-primary/50 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <FileText className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                      {design ? (
                        <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 font-medium">
                          Designed
                        </span>
                      ) : (
                        <span className="text-xs bg-muted text-muted-foreground border border-border rounded-full px-2 py-0.5 flex items-center gap-1">
                          <Plus className="h-3 w-3" />
                          New
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">{table.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono">{table.table_name}</p>
                    {design && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Last updated: {new Date(design.updated_at).toLocaleDateString()}
                      </p>
                    )}
                    <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      {design ? "Edit Design" : "Create Design"}
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ADSidebar>
  );
}
