import { useQuery } from "@tanstack/react-query";
import { Check, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

interface MonitoringExecution {
  id: string;
  monitoring_rule_id: string;
  executed_at: string;
  evaluation_status: "PASS" | "BREACH" | "ESCALATE" | "NO_DATA" | "ERROR";
  metric_value?: number | null;
  previous_metric_value?: number | null;
  delta_pct?: number | null;
  alert_dispatched: boolean;
  alert_channels_used?: string[];
  alert_recipients_sent?: string[];
  alert_sent_at?: string | null;
  execution_ms?: number | null;
  rows_returned?: number | null;
  sql_executed?: string | null;
  error_message?: string | null;
  error_phase?: string | null;
}

interface ExecutionsResponse {
  executions: MonitoringExecution[];
  total: number;
  page: number;
  pageSize: number;
}

interface Props {
  ruleId: string;
}

function StatusBadge({ status }: { status: MonitoringExecution["evaluation_status"] }) {
  switch (status) {
    case "PASS":
      return (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">
          PASS
        </Badge>
      );
    case "BREACH":
      return (
        <Badge className="bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100">
          BREACH
        </Badge>
      );
    case "ESCALATE":
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">ESCALATE</Badge>
      );
    case "NO_DATA":
      return (
        <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">
          NO_DATA
        </Badge>
      );
    case "ERROR":
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">ERROR</Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatThresholdCompare(exec: MonitoringExecution): string {
  if (exec.metric_value == null) return "—";
  return exec.metric_value.toLocaleString();
}

function DeltaBadge({ delta }: { delta: number | null | undefined }) {
  if (delta == null) return <span className="text-tremor-content">—</span>;
  const sign = delta >= 0 ? "+" : "";
  const color = delta >= 0 ? "text-emerald-600" : "text-red-600";
  return (
    <span className={`font-medium text-sm ${color}`}>
      {sign}
      {delta.toFixed(1)}%
    </span>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 7 }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function ExecutionHistoryTable({ ruleId }: Props) {
  const { data, isLoading } = useQuery<ExecutionsResponse>({
    queryKey: ["monitoring-executions", ruleId],
    queryFn: async () => {
      const res = await fetch(`/api/monitoring/rules/${ruleId}/executions`);
      if (!res.ok) throw new Error("Failed to fetch execution history");
      return res.json();
    },
    enabled: !!ruleId,
  });

  const executions = data?.executions ?? [];

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Executed At</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Metric Value</TableHead>
            <TableHead>vs Threshold</TableHead>
            <TableHead>Change %</TableHead>
            <TableHead>Alert Sent</TableHead>
            <TableHead>Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <SkeletonRows />
          ) : executions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                No execution history yet. This rule has not run yet.
              </TableCell>
            </TableRow>
          ) : (
            executions.map((exec) => (
              <TableRow key={exec.id}>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {formatDateTime(exec.executed_at)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={exec.evaluation_status} />
                </TableCell>
                <TableCell className="text-sm">
                  {exec.metric_value != null ? exec.metric_value.toLocaleString() : "—"}
                </TableCell>
                <TableCell className="text-sm">{formatThresholdCompare(exec)}</TableCell>
                <TableCell>
                  <DeltaBadge delta={exec.delta_pct} />
                </TableCell>
                <TableCell>
                  {exec.alert_dispatched ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Minus className="h-4 w-4 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell className="text-tremor-default text-tremor-content">
                  {exec.execution_ms != null ? `${exec.execution_ms}ms` : "—"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
