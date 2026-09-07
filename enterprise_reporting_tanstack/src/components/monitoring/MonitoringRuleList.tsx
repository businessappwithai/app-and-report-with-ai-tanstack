import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  History,
  Loader2,
  Pause,
  Play,
  Plus,
  Search,
  Trash2,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ExecutionHistoryTable } from "./ExecutionHistoryTable";
import { ExecutionInvestigateModal } from "./ExecutionInvestigateModal";

interface MonitoringRule {
  id: string;
  name: string;
  data_source_id: string;
  data_source_name?: string;
  metric_column: string;
  threshold_operator: string;
  threshold_value: number;
  threshold_upper_bound?: number | null;
  schedule_cron: string;
  status: "active" | "paused" | "error";
  last_run_at?: string | null;
  last_metric_value?: number | null;
  created_at: string;
  updated_at: string;
}

interface MonitoringRulesResponse {
  rules: MonitoringRule[];
  total: number;
  page: number;
  pageSize: number;
}

export function describeCron(cron: string): string {
  const map: Record<string, string> = {
    "0 8 * * 1": "Every Monday at 08:00",
    "0 8 * * 2": "Every Tuesday at 08:00",
    "0 8 * * 3": "Every Wednesday at 08:00",
    "0 8 * * 4": "Every Thursday at 08:00",
    "0 8 * * 5": "Every Friday at 08:00",
    "0 8 * * 6": "Every Saturday at 08:00",
    "0 8 * * 0": "Every Sunday at 08:00",
    "0 8 * * *": "Daily at 08:00",
    "0 0 * * *": "Daily at midnight",
    "0 * * * *": "Hourly",
    "0 8 1 * *": "Monthly on 1st at 08:00",
    "0 0 1 * *": "Monthly on 1st at midnight",
    "*/5 * * * *": "Every 5 minutes",
    "*/15 * * * *": "Every 15 minutes",
    "*/30 * * * *": "Every 30 minutes",
    "0 9 * * 1-5": "Weekdays at 09:00",
    "0 9 * * *": "Daily at 09:00",
    "0 6 * * *": "Daily at 06:00",
    "0 12 * * *": "Daily at noon",
    "0 18 * * *": "Daily at 18:00",
    "0 0 * * 1": "Every Monday at midnight",
  };
  return map[cron] ?? cron;
}

function formatThreshold(operator: string, value: number, upperBound?: number | null): string {
  const fmt = (n: number) => n.toLocaleString();
  switch (operator) {
    case "lt":
      return `< ${fmt(value)}`;
    case "lte":
      return `≤ ${fmt(value)}`;
    case "gt":
      return `> ${fmt(value)}`;
    case "gte":
      return `≥ ${fmt(value)}`;
    case "eq":
      return `= ${fmt(value)}`;
    case "neq":
      return `≠ ${fmt(value)}`;
    case "between":
      return `between ${fmt(value)} and ${fmt(upperBound ?? 0)}`;
    default:
      return `${operator} ${fmt(value)}`;
  }
}

function StatusBadge({ status }: { status: MonitoringRule["status"] }) {
  if (status === "active") {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">
        Active
      </Badge>
    );
  }
  if (status === "paused") {
    return (
      <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
        Paused
      </Badge>
    );
  }
  return <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">Error</Badge>;
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 9 }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function MonitoringRuleList() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const [historyRuleId, setHistoryRuleId] = useState<string | null>(null);
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);
  const [investigateRule, setInvestigateRule] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useQuery<MonitoringRulesResponse>({
    queryKey: ["monitoring-rules", page, pageSize],
    queryFn: async () => {
      const res = await fetch(`/api/monitoring/rules?page=${page}&pageSize=${pageSize}`);
      if (!res.ok) throw new Error("Failed to fetch monitoring rules");
      return res.json();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "pause" | "resume" }) => {
      const res = await fetch(`/api/monitoring/rules/${id}?action=${action}`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error(`Failed to ${action} rule`);
      return res.json();
    },
    onSuccess: (_, { action }) => {
      toast.success(`Rule ${action === "pause" ? "paused" : "resumed"}`);
      queryClient.invalidateQueries({ queryKey: ["monitoring-rules"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Action failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/monitoring/rules/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete rule");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Monitoring rule deleted");
      setDeleteRuleId(null);
      queryClient.invalidateQueries({ queryKey: ["monitoring-rules"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    },
  });

  const [runningRuleId, setRunningRuleId] = useState<string | null>(null);

  const runMutation = useMutation({
    mutationFn: async (id: string) => {
      setRunningRuleId(id);
      const res = await fetch(`/api/monitoring/rules/${id}?action=run`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed to run rule");
      return res.json() as Promise<{
        result: { status: string; metricValue?: number | null; error?: string };
      }>;
    },
    onSuccess: (data, id) => {
      const { result } = data;
      setRunningRuleId(null);
      queryClient.invalidateQueries({ queryKey: ["monitoring-rules"] });
      if (result.status === "BREACH" || result.status === "ESCALATE") {
        toast.warning(`Rule executed — BREACH detected (value: ${result.metricValue ?? "N/A"})`);
      } else if (result.status === "PASS") {
        toast.success(`Rule executed — threshold passed (value: ${result.metricValue ?? "N/A"})`);
      } else if (result.status === "NO_DATA") {
        toast.info("Rule executed — no data returned");
      } else if (result.status === "SKIPPED") {
        toast.info("Rule skipped (paused or inactive)");
      } else {
        toast.success(`Rule executed — status: ${result.status}`);
      }
    },
    onError: (err) => {
      setRunningRuleId(null);
      toast.error(err instanceof Error ? err.message : "Run failed");
    },
  });

  const rules = data?.rules ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);
  const ruleToDelete = rules.find((r) => r.id === deleteRuleId);

  if (!isLoading && rules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="rounded-full bg-muted p-6">
          <Activity className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-lg font-medium">No monitoring rules yet</p>
          <p className="text-tremor-default text-tremor-content">
            Create your first monitoring rule to start tracking metrics
          </p>
        </div>
        <Link to="/monitoring/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Rule
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Data Source</TableHead>
              <TableHead>Metric Column</TableHead>
              <TableHead>Threshold</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead>Last Value</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <SkeletonRows />
            ) : (
              rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {rule.data_source_name ?? rule.data_source_id}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{rule.metric_column}</TableCell>
                  <TableCell className="text-sm">
                    {formatThreshold(
                      rule.threshold_operator,
                      rule.threshold_value,
                      rule.threshold_upper_bound
                    )}
                  </TableCell>
                  <TableCell className="text-tremor-default text-tremor-content">
                    {describeCron(rule.schedule_cron)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={rule.status} />
                  </TableCell>
                  <TableCell className="text-tremor-default text-tremor-content">
                    {rule.last_run_at ? formatDateTime(rule.last_run_at) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {rule.last_metric_value != null ? rule.last_metric_value.toLocaleString() : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setHistoryRuleId(rule.id)}
                        title="View history"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setInvestigateRule({ id: rule.id, name: rule.name })}
                        title="Investigate last run"
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={runningRuleId === rule.id}
                        onClick={() => runMutation.mutate(rule.id)}
                        title="Run now"
                      >
                        {runningRuleId === rule.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Zap className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={toggleMutation.isPending}
                        onClick={() =>
                          toggleMutation.mutate({
                            id: rule.id,
                            action: rule.status === "active" ? "pause" : "resume",
                          })
                        }
                        title={rule.status === "active" ? "Pause rule" : "Resume rule"}
                      >
                        {rule.status === "active" ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteRuleId(rule.id)}
                        title="Delete rule"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-tremor-default text-tremor-content">
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={historyRuleId !== null}
        onOpenChange={(open) => !open && setHistoryRuleId(null)}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Execution History
            </DialogTitle>
            <DialogDescription>Recent executions for this monitoring rule</DialogDescription>
          </DialogHeader>
          {historyRuleId && <ExecutionHistoryTable ruleId={historyRuleId} />}
        </DialogContent>
      </Dialog>

      {investigateRule && (
        <ExecutionInvestigateModal
          ruleId={investigateRule.id}
          ruleName={investigateRule.name}
          open={investigateRule !== null}
          onClose={() => setInvestigateRule(null)}
        />
      )}

      <Dialog open={deleteRuleId !== null} onOpenChange={(open) => !open && setDeleteRuleId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Delete Monitoring Rule
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{ruleToDelete?.name}</strong>? This will also
              remove all execution history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteRuleId(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteRuleId && deleteMutation.mutate(deleteRuleId)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
