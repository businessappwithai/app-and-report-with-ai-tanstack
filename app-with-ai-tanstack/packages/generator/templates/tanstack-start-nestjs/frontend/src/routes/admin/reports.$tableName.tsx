import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileText, Home } from "lucide-react";
import { ADSidebar } from "@/components/admin/ad-sidebar";
import { ReportDesigner } from "@/components/reports/ReportDesigner";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/admin/reports/$tableName")({
  component: ReportDesignPage,
});

interface ColumnMeta {
  column_name: string;
  name?: string;
}

interface ColumnMetaResponse {
  columns?: ColumnMeta[];
}

function ReportDesignPage() {
  const { tableName } = Route.useParams();

  const { data: meta, isLoading } = useQuery({
    queryKey: ["sys-columns-for-report", tableName],
    queryFn: () =>
      apiClient.get<ColumnMetaResponse>(`/sys/entity-metadata/${tableName}`),
    enabled: !!tableName,
  });

  const columns: string[] = (meta?.columns ?? []).map((c) => c.column_name).filter(Boolean);

  return (
    <ADSidebar>
      <div className="flex flex-col h-full">
        <header className="border-b border-border bg-card px-8 py-6 shrink-0">
          <div className="flex items-center gap-3 mb-1 text-sm text-muted-foreground">
            <Link
              to="/dashboard"
              className="flex items-center gap-1 hover:text-primary transition-colors"
            >
              <Home className="h-3.5 w-3.5" />
              Dashboard
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <Link
              to="/admin"
              className="hover:text-primary transition-colors"
            >
              Admin
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <Link
              to="/admin/reports"
              className="hover:text-primary transition-colors"
            >
              Report Designs
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-foreground font-medium">{tableName}</span>
          </div>
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">
              Report Designer — <span className="text-primary">{tableName}</span>
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Design the document layout for this entity. Users will see a Print button when viewing records.
          </p>
        </header>

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <ReportDesigner tableName={tableName} columns={columns} />
          )}
        </div>
      </div>
    </ADSidebar>
  );
}
