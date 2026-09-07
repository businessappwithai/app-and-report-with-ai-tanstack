import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Table2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import type { ReportHistoryEntry } from "@/lib/report-generation/types";

interface Props {
  reports: ReportHistoryEntry[];
}

function StatusBadge({ status }: { status: string | null }) {
  switch (status) {
    case "complete":
      return (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">
          Complete
        </Badge>
      );
    case "running":
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">
          Running
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">Failed</Badge>
      );
    case "permission_revoked":
      return (
        <Badge className="bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100">
          Access Revoked
        </Badge>
      );
    case "no_data":
      return (
        <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">
          No Data
        </Badge>
      );
    default:
      return <Badge variant="outline">Never Run</Badge>;
  }
}

function FormatIcon({ format }: { format: string }) {
  switch (format) {
    case "excel":
      return <FileSpreadsheet className="h-3 w-3" />;
    case "pdf":
      return <FileText className="h-3 w-3" />;
    case "csv":
      return <Table2 className="h-3 w-3" />;
    default:
      return null;
  }
}

function ArtifactDownloadButtons({ reportId }: { reportId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["report-artifacts", reportId],
    queryFn: async () => {
      const res = await fetch(`/api/report-generation/artifacts/${reportId}`);
      if (!res.ok) return { executions: [] };
      return res.json();
    },
  });

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;

  const latest = data?.executions?.[0];
  if (!latest?.artifacts?.length)
    return <span className="text-tremor-label text-tremor-content">No files</span>;

  async function triggerDownload(downloadUrl: string, filename: string) {
    const resp = await fetch(downloadUrl, { credentials: "include" });
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 100);
  }

  return (
    <div className="flex gap-1">
      {latest.artifacts.map((a: any) => (
        <Button
          key={a.id}
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1"
          onClick={() => triggerDownload(a.downloadUrl, a.filename)}
          title={`Download ${a.format.toUpperCase()}`}
        >
          <FormatIcon format={a.format} />
          {a.format.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}

export function ReportHistoryPanel({ reports }: Props) {
  // If no reports from CopilotKit action, fetch directly
  const { data: fetchedReports, isLoading } = useQuery({
    queryKey: ["report-definitions", "history"],
    queryFn: async () => {
      const res = await fetch("/api/report-generation/definitions?history=true&pageSize=50");
      if (!res.ok) return { definitions: [] };
      return res.json();
    },
    enabled: reports.length === 0,
  });

  const displayReports: ReportHistoryEntry[] =
    reports.length > 0
      ? reports
      : (fetchedReports?.definitions ?? []).map((d: any) => ({
          id: d.id,
          title: d.title,
          nlQuery: d.nl_query,
          dataSourceName: d.data_source_name ?? "Unknown",
          chartType: d.chart_type,
          createdAt: d.created_at,
          lastRunAt: d.last_run_at,
          lastRunStatus: d.last_run_status,
          artifactCount: d.artifactCount ?? 0,
          formats: d.output_formats ?? [],
        }));

  if (isLoading && reports.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full mb-2" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (displayReports.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="rounded-full bg-muted p-6">
            <Clock className="h-10 w-10 text-muted-foreground" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-lg font-medium">No report history</p>
            <p className="text-tremor-default text-tremor-content">
              Generate your first report using the chat panel, or ask "Show me my reports from last
              week."
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Report</TableHead>
            <TableHead>Data Source</TableHead>
            <TableHead>Chart</TableHead>
            <TableHead>Formats</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Run</TableHead>
            <TableHead className="text-right">Download</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayReports.map((report) => (
            <TableRow key={report.id}>
              <TableCell>
                <div>
                  <p className="font-medium text-sm">{report.title}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {report.nlQuery}
                  </p>
                </div>
              </TableCell>
              <TableCell className="text-tremor-default text-tremor-content">
                {report.dataSourceName}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs capitalize">
                  <BarChart3 className="h-3 w-3 mr-1" />
                  {report.chartType}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {report.formats.map((f) => (
                    <Badge key={f} variant="secondary" className="text-xs uppercase gap-1">
                      <FormatIcon format={f} />
                      {f}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={report.lastRunStatus} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                {report.lastRunAt ? formatDateTime(report.lastRunAt) : "—"}
              </TableCell>
              <TableCell className="text-right">
                {report.lastRunStatus === "complete" ? (
                  <ArtifactDownloadButtons reportId={report.id} />
                ) : (
                  <span className="text-tremor-label text-tremor-content">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
