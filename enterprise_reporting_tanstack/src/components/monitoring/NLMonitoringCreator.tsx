import { CheckCircle2, ChevronLeft, Info, Loader2 } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { describeCron } from "./MonitoringRuleList";
import { ThresholdConfigurator } from "./ThresholdConfigurator";

interface DataSource {
  id: string;
  name: string;
  client_type: string;
}

interface ParsedIntent {
  metric?: string;
  threshold_operator?: string;
  threshold_value?: number;
  threshold_upper_bound?: number;
  schedule_cron?: string;
  generated_sql?: string;
  rule_id?: string;
  next_run_at?: string;
}

interface Props {
  onSuccess: (result: { ruleId: string; nextRunAt?: string }) => void;
  onCancel: () => void;
}

type AlertChannel = "email" | "in_app" | "webhook";

export function NLMonitoringCreator({ onSuccess, onCancel }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);

  // Step 1 state
  const [nlRequest, setNlRequest] = useState("");
  const [dataSourceId, setDataSourceId] = useState("");
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [dsLoading, setDsLoading] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [dsLoaded, setDsLoaded] = useState(false);

  // Step 2 state
  const [parsedIntent, setParsedIntent] = useState<ParsedIntent | null>(null);
  const [ruleName, setRuleName] = useState("");
  const [metricColumn, setMetricColumn] = useState("");
  const [thresholdOperator, setThresholdOperator] = useState("lt");
  const [thresholdValue, setThresholdValue] = useState(0);
  const [thresholdUpper, setThresholdUpper] = useState<number | undefined>();
  const [scheduleCron, setScheduleCron] = useState("0 8 * * 1");
  const [alertChannels, setAlertChannels] = useState<AlertChannel[]>(["in_app"]);
  const [createLoading, setCreateLoading] = useState(false);

  // Step 3 state
  const [successResult, setSuccessResult] = useState<{
    ruleId: string;
    nextRunAt?: string;
  } | null>(null);

  async function loadDataSources() {
    if (dsLoaded) return;
    setDsLoading(true);
    try {
      const res = await fetch("/api/data-sources");
      if (!res.ok) throw new Error("Failed to load data sources");
      const data = await res.json();
      setDataSources(data.items ?? data.data?.items ?? []);
      setDsLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data sources");
    } finally {
      setDsLoading(false);
    }
  }

  async function handleAnalyze() {
    if (!nlRequest.trim()) {
      setError("Please describe what you want to monitor.");
      return;
    }
    if (!dataSourceId) {
      setError("Please select a data source.");
      return;
    }
    setError(null);
    setAnalyzeLoading(true);
    try {
      const res = await fetch("/api/adk/analyze-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nlRequest, dataSourceId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.clarificationNeeded) {
          throw new Error(
            data.clarificationPrompt ?? "Please provide more detail about what you want to monitor."
          );
        }
        throw new Error(data.error ?? data.error?.message ?? "Failed to analyze intent");
      }
      const preview = data.preview;
      const adkIntent = data.adkIntent;
      const intent: ParsedIntent = {
        metric: preview?.metricColumn ?? adkIntent?.metric ?? "",
        threshold_operator: preview?.thresholdOperator ?? adkIntent?.thresholdOperator ?? "lt",
        threshold_value: preview?.thresholdValue ?? adkIntent?.thresholdValue ?? 0,
        threshold_upper_bound: preview?.thresholdUpperBound ?? adkIntent?.thresholdUpperBound,
        schedule_cron: preview?.cronExpression ?? adkIntent?.scheduleCron ?? "0 8 * * 1",
        generated_sql: preview?.sql,
      };
      setParsedIntent(intent);
      setRuleName(preview?.name ?? `Monitor: ${nlRequest.slice(0, 60)}`);
      setMetricColumn(intent.metric ?? "value");
      setThresholdOperator(intent.threshold_operator ?? "lt");
      setThresholdValue(intent.threshold_value ?? 0);
      setThresholdUpper(intent.threshold_upper_bound);
      setScheduleCron(intent.schedule_cron ?? "0 8 * * 1");
      if (preview?.alertChannels?.length) {
        setAlertChannels(
          preview.alertChannels.filter((c: string): c is AlertChannel =>
            ["email", "in_app", "webhook"].includes(c)
          )
        );
      }
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzeLoading(false);
    }
  }

  async function handleCreate() {
    if (!parsedIntent) {
      setError("No intent data available.");
      return;
    }
    setError(null);
    setCreateLoading(true);
    try {
      const res = await fetch("/api/monitoring/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: ruleName || `Monitor: ${nlRequest.slice(0, 60)}`,
          description: nlRequest,
          dataSourceId: dataSourceId,
          metricColumn: metricColumn || parsedIntent.metric || "value",
          thresholdOperator: thresholdOperator,
          thresholdValue: thresholdValue,
          thresholdUpperBound: thresholdUpper,
          cronExpression: scheduleCron,
          alertChannels: alertChannels,
          sql: parsedIntent.generated_sql,
          originalNlRequest: nlRequest,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to create monitoring rule");
      }
      const ruleId = data.rule?.id ?? data.rule_id ?? data.id ?? "";
      const nextRunAt = data.rule?.trigger_schedule_id ? undefined : undefined;
      setSuccessResult({ ruleId, nextRunAt });
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Creation failed");
    } finally {
      setCreateLoading(false);
    }
  }

  function toggleChannel(channel: AlertChannel) {
    setAlertChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  }

  if (step === 3 && successResult) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center">
        <div className="rounded-full bg-emerald-100 p-5">
          <CheckCircle2 className="h-12 w-12 text-emerald-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Monitoring rule created!</h2>
          {successResult.nextRunAt && (
            <p className="text-muted-foreground text-sm">
              Next scheduled run:{" "}
              <span className="font-medium text-foreground">
                {new Date(successResult.nextRunAt).toLocaleString()}
              </span>
            </p>
          )}
        </div>
        <Button onClick={() => onSuccess(successResult)}>View All Rules</Button>
      </div>
    );
  }

  if (step === 2 && parsedIntent) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h2 className="text-lg font-semibold">Review Generated Plan</h2>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="rule-name" className="text-sm font-medium">
            Rule Name
          </Label>
          <input
            id="rule-name"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Detected Intent</Label>
          <div className="flex flex-wrap gap-2">
            {(parsedIntent.metric || metricColumn) && (
              <Badge variant="secondary">Metric: {parsedIntent.metric || metricColumn}</Badge>
            )}
            {parsedIntent.threshold_operator && (
              <Badge variant="secondary">
                Threshold: {parsedIntent.threshold_operator}{" "}
                {parsedIntent.threshold_value?.toLocaleString()}
              </Badge>
            )}
            {parsedIntent.schedule_cron && (
              <Badge variant="secondary">
                Schedule: {describeCron(parsedIntent.schedule_cron)}
              </Badge>
            )}
          </div>
        </div>

        {parsedIntent.generated_sql && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Generated SQL</Label>
            <pre className="bg-gray-50 border rounded-md p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap text-gray-800">
              {parsedIntent.generated_sql}
            </pre>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              SQL was auto-generated. Contact admin to modify.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-sm font-medium">Threshold</Label>
          <ThresholdConfigurator
            operator={thresholdOperator}
            value={thresholdValue}
            upperBound={thresholdUpper}
            onChange={(op, val, upper) => {
              setThresholdOperator(op);
              setThresholdValue(val);
              setThresholdUpper(upper);
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="schedule-cron" className="text-sm font-medium">
            Schedule (cron expression)
          </Label>
          <Input
            id="schedule-cron"
            value={scheduleCron}
            onChange={(e) => setScheduleCron(e.target.value)}
            placeholder="e.g. 0 8 * * 1"
            className="font-mono"
          />
          <p className="text-tremor-label text-tremor-content">{describeCron(scheduleCron)}</p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Alert Channels</Label>
          <div className="flex flex-col gap-2">
            {(["email", "in_app", "webhook"] as AlertChannel[]).map((ch) => (
              <div key={ch} className="flex items-center gap-2">
                <Checkbox
                  id={`channel-${ch}`}
                  checked={alertChannels.includes(ch)}
                  onCheckedChange={() => toggleChannel(ch)}
                />
                <Label htmlFor={`channel-${ch}`} className="font-normal capitalize cursor-pointer">
                  {ch === "in_app"
                    ? "In-App Notification"
                    : ch.charAt(0).toUpperCase() + ch.slice(1)}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={() => setStep(1)} disabled={createLoading}>
            Back
          </Button>
          <Button onClick={handleCreate} disabled={createLoading} className="flex-1">
            {createLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Monitoring Rule"
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Describe Your Monitor</h2>
        <p className="mt-1 text-tremor-default text-tremor-content">
          Use plain language to describe what you want to monitor and when to alert.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="nl-request">What do you want to monitor?</Label>
        <Textarea
          id="nl-request"
          value={nlRequest}
          onChange={(e) => setNlRequest(e.target.value)}
          placeholder="Describe what you want to monitor..."
          rows={4}
          className="resize-none"
        />
        <div className="text-xs text-muted-foreground space-y-0.5">
          <p className="font-medium">Examples:</p>
          <p>e.g. Alert me every Monday if weekly revenue drops below $50,000</p>
          <p>e.g. Notify me daily if the number of failed orders exceeds 100</p>
          <p>e.g. Alert hourly if active user count falls below 500</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="data-source">Data Source</Label>
        <Select
          value={dataSourceId}
          onValueChange={setDataSourceId}
          onOpenChange={(open) => open && loadDataSources()}
        >
          <SelectTrigger id="data-source">
            <SelectValue placeholder="Select a data source..." />
          </SelectTrigger>
          <SelectContent>
            {dsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : dataSources.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground px-2">
                No data sources available
              </div>
            ) : (
              dataSources.map((ds) => (
                <SelectItem key={ds.id} value={ds.id}>
                  <span className="font-medium">{ds.name}</span>
                  <span className="text-muted-foreground ml-2 text-xs">({ds.client_type})</span>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} disabled={analyzeLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleAnalyze}
          disabled={analyzeLoading || !nlRequest.trim() || !dataSourceId}
          className="flex-1"
        >
          {analyzeLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing your request...
            </>
          ) : (
            "Analyze Intent"
          )}
        </Button>
      </div>
    </div>
  );
}
