import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  Database,
  Loader2,
  MailCheck,
  MailX,
  Search,
  ShieldCheck,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils";

interface Execution {
  id: string;
  monitoring_rule_id: string;
  executed_at: string;
  evaluation_status: string;
  metric_value: number | null;
  previous_metric_value: number | null;
  delta_pct: number | null;
  alert_dispatched: boolean;
  alert_channels_used: string[];
  alert_recipients_sent: string[];
  alert_sent_at: string | null;
  execution_ms: number | null;
  rows_returned: number | null;
  sql_executed: string | null;
  error_message: string | null;
  error_phase: string | null;
}

interface Props {
  ruleId: string;
  ruleName: string;
  open: boolean;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  PASS: "text-emerald-600",
  BREACH: "text-orange-600",
  ESCALATE: "text-red-600",
  NO_DATA: "text-gray-500",
  ERROR: "text-red-600",
  SKIPPED: "text-gray-400",
};

const STATUS_BG: Record<string, string> = {
  PASS: "bg-emerald-50 border-emerald-200",
  BREACH: "bg-orange-50 border-orange-200",
  ESCALATE: "bg-red-50 border-red-200",
  NO_DATA: "bg-gray-50 border-gray-200",
  ERROR: "bg-red-50 border-red-200",
  SKIPPED: "bg-gray-50 border-gray-200",
};

function StepIcon({ ok, error }: { ok: boolean; error?: boolean }) {
  if (error) return <XCircle className="h-5 w-5 text-red-500 shrink-0" />;
  if (ok) return <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />;
  return <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />;
}

function Step({
  num,
  title,
  icon,
  ok,
  error,
  children,
  defaultOpen = false,
}: {
  num: number;
  title: string;
  icon: React.ReactNode;
  ok: boolean;
  error?: boolean;
  children?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-xs font-mono text-muted-foreground w-5 text-right shrink-0">
          {num}
        </span>
        <span className="text-muted-foreground shrink-0">{icon}</span>
        <span className="font-medium text-sm flex-1">{title}</span>
        <StepIcon ok={ok} error={error} />
        {children &&
          (open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          ))}
      </button>
      {open && children && (
        <div className="px-4 py-3 border-t text-sm space-y-2 bg-background">{children}</div>
      )}
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground min-w-36 shrink-0">{label}</span>
      <span className="font-medium break-all">{value}</span>
    </div>
  );
}

function SqlBlock({ sql }: { sql: string }) {
  return (
    <pre className="bg-muted rounded p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-48">
      {sql}
    </pre>
  );
}

export function ExecutionInvestigateModal({ ruleId, ruleName, open, onClose }: Props) {
  const { data, isLoading } = useQuery<{ executions: Execution[]; total: number }>({
    queryKey: ["monitoring-executions-investigate", ruleId],
    queryFn: async () => {
      const res = await fetch(`/api/monitoring/rules/${ruleId}/executions?page=0&pageSize=1`);
      if (!res.ok) throw new Error("Failed to fetch execution");
      return res.json();
    },
    enabled: open && !!ruleId,
  });

  const exec = data?.executions?.[0];
  const status = exec?.evaluation_status ?? "";
  const hasError = status === "ERROR" || !!exec?.error_message;
  const isBreached = status === "BREACH" || status === "ESCALATE";
  const isPass = status === "PASS";
  const noData = status === "NO_DATA";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Execution Investigation
          </DialogTitle>
          <DialogDescription>
            Step-by-step trace for the most recent run of{" "}
            <span className="font-medium text-foreground">{ruleName}</span>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !exec ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
            <Clock className="h-10 w-10" />
            <p>No executions recorded yet. Use the ⚡ Run Now button to trigger a run.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Summary banner */}
            <div
              className={`rounded-lg border px-4 py-3 flex items-center gap-3 ${STATUS_BG[status] ?? "bg-muted border-muted"}`}
            >
              <TrendingUp
                className={`h-5 w-5 ${STATUS_COLORS[status] ?? "text-muted-foreground"}`}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-sm ${STATUS_COLORS[status] ?? ""}`}>
                    {status}
                  </span>
                  {exec.execution_ms != null && (
                    <span className="text-tremor-label text-tremor-content">
                      · {exec.execution_ms}ms total
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDateTime(exec.executed_at)}
                </p>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {exec.id.slice(0, 8)}…
              </Badge>
            </div>

            {/* Step 1: Rule loaded */}
            <Step num={1} title="Rule Loaded" icon={<Database className="h-4 w-4" />} ok={true}>
              <KV
                label="Rule ID"
                value={<span className="font-mono text-xs">{exec.monitoring_rule_id}</span>}
              />
              <KV
                label="Execution ID"
                value={<span className="font-mono text-xs">{exec.id}</span>}
              />
              <KV label="Triggered at" value={formatDateTime(exec.executed_at)} />
            </Step>

            {/* Step 2: RBAC */}
            <Step
              num={2}
              title="RBAC Validation"
              icon={<ShieldCheck className="h-4 w-4" />}
              ok={status !== "RBAC_DRIFT"}
              error={status === "RBAC_DRIFT"}
            >
              <KV
                label="Result"
                value={
                  status === "RBAC_DRIFT" ? (
                    <span className="text-red-600">Permission revoked — rule auto-paused</span>
                  ) : (
                    <span className="text-emerald-600">Access granted</span>
                  )
                }
              />
            </Step>

            {/* Step 3: SQL execution */}
            <Step
              num={3}
              title={`SQL Execution${exec.rows_returned != null ? ` — ${exec.rows_returned} row${exec.rows_returned !== 1 ? "s" : ""} returned` : ""}`}
              icon={<Code2 className="h-4 w-4" />}
              ok={!hasError && !noData}
              error={hasError && exec.error_phase === "sql_execution"}
              defaultOpen={true}
            >
              {exec.execution_ms != null && (
                <KV label="Duration" value={`${exec.execution_ms}ms`} />
              )}
              {exec.rows_returned != null && (
                <KV label="Rows returned" value={exec.rows_returned} />
              )}
              {exec.sql_executed ? (
                <>
                  <p className="text-muted-foreground text-xs mt-1 mb-1">SQL executed:</p>
                  <SqlBlock sql={exec.sql_executed} />
                </>
              ) : (
                <p className="text-muted-foreground italic">SQL not recorded</p>
              )}
              {exec.error_message && exec.error_phase === "sql_execution" && (
                <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {exec.error_message}
                </div>
              )}
            </Step>

            {/* Step 4: Threshold evaluation */}
            <Step
              num={4}
              title={`Threshold Evaluation — ${status}`}
              icon={<TrendingUp className="h-4 w-4" />}
              ok={isPass}
              error={isBreached || hasError}
              defaultOpen={true}
            >
              <KV
                label="Metric value"
                value={
                  exec.metric_value != null ? (
                    <span
                      className={`font-bold ${isBreached ? "text-red-600" : isPass ? "text-emerald-600" : ""}`}
                    >
                      {exec.metric_value.toLocaleString()}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              {exec.previous_metric_value != null && (
                <KV label="Previous value" value={exec.previous_metric_value.toLocaleString()} />
              )}
              {exec.delta_pct != null && (
                <KV
                  label="Change"
                  value={
                    <span className={exec.delta_pct >= 0 ? "text-emerald-600" : "text-red-600"}>
                      {exec.delta_pct >= 0 ? "+" : ""}
                      {exec.delta_pct.toFixed(2)}%
                    </span>
                  }
                />
              )}
              <KV
                label="Outcome"
                value={
                  noData ? (
                    <span className="text-gray-500">No data returned from query</span>
                  ) : isBreached ? (
                    <span className="text-red-600 font-bold">
                      Threshold breached —{" "}
                      {status === "ESCALATE" ? "critical escalation" : "warning"}
                    </span>
                  ) : isPass ? (
                    <span className="text-emerald-600">Threshold satisfied — no alert needed</span>
                  ) : (
                    <span>{status}</span>
                  )
                }
              />
            </Step>

            {/* Step 5: Alert dispatch */}
            <Step
              num={5}
              title={
                exec.alert_dispatched
                  ? `Alert Dispatched — ${exec.alert_channels_used?.join(", ") || "—"}`
                  : "Alert Dispatch — Skipped"
              }
              icon={
                exec.alert_dispatched ? (
                  <MailCheck className="h-4 w-4" />
                ) : (
                  <MailX className="h-4 w-4" />
                )
              }
              ok={exec.alert_dispatched || isPass}
              error={isBreached && !exec.alert_dispatched}
            >
              <KV
                label="Alert sent"
                value={
                  exec.alert_dispatched ? (
                    <span className="text-emerald-600">Yes</span>
                  ) : (
                    <span className="text-tremor-content">
                      {isPass ? "No — threshold passed (notify_on_pass=false)" : "No"}
                    </span>
                  )
                }
              />
              {exec.alert_dispatched && exec.alert_channels_used?.length > 0 && (
                <KV
                  label="Channels"
                  value={
                    <div className="flex gap-1 flex-wrap">
                      {exec.alert_channels_used.map((ch) => (
                        <Badge key={ch} variant="outline" className="text-xs">
                          {ch}
                        </Badge>
                      ))}
                    </div>
                  }
                />
              )}
              {exec.alert_dispatched && exec.alert_recipients_sent?.length > 0 && (
                <KV
                  label="Recipients"
                  value={`${exec.alert_recipients_sent.length} recipient(s)`}
                />
              )}
              {exec.alert_sent_at && (
                <KV label="Sent at" value={formatDateTime(exec.alert_sent_at)} />
              )}
            </Step>

            {/* Step 6: Record written */}
            <Step
              num={6}
              title="Execution Record Written"
              icon={<CheckCircle2 className="h-4 w-4" />}
              ok={true}
            >
              <KV label="Record ID" value={<span className="font-mono text-xs">{exec.id}</span>} />
              <KV label="Stored at" value={formatDateTime(exec.executed_at)} />
              {exec.error_message && exec.error_phase !== "sql_execution" && (
                <>
                  <KV label="Error phase" value={exec.error_phase ?? "unknown"} />
                  <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {exec.error_message}
                  </div>
                </>
              )}
            </Step>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
