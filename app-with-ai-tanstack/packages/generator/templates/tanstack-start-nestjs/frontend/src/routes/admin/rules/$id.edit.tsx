import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle,
  HelpCircle,
  History,
  Loader2,
  Save,
  TestTube2,
  ToggleLeft,
  ToggleRight,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RuleTableEditor } from "@/components/automation/RuleTableEditor";
import { asDecisionTable } from "@/lib/automation/rule-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/admin/rules/$id/edit")({
  component: EditRulePage,
});


interface Rule {
  id: string;
  entityName: string;
  ruleName: string;
  operation: string;
  version: number;
  isActive: boolean;
  jdmContent: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

function EditRulePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [jdmContent, setJdmContent] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Dry run state
  const [testData, setTestData] = useState("{}");
  const [testResult, setTestResult] = useState<any>(null);
  const [showTestPanel, setShowTestPanel] = useState(false);

  const { data: rule, isLoading } = useQuery({
    queryKey: ["admin", "rules", id],
    queryFn: async () => {
      return await apiClient.get<Rule>(`/rules/${id}`);
    },
  });

  // The decision table's trigger-workflow action offers these by name. Without
  // them this page referenced an undefined `availableWorkflows` and failed to
  // compile, so editing an existing rule was impossible.
  const { data: workflowsData } = useQuery({
    queryKey: ["workflow-definitions"],
    queryFn: async () => {
      const data = await apiClient.get<any[]>("/workflow-definitions?isActive=true");
      return Array.isArray(data) ? data : [];
    },
  });
  const availableWorkflows = (workflowsData ?? []).map((wf: any) => ({
    id: wf.id,
    name: wf.name,
    description: wf.description,
  }));

  useEffect(() => {
    if (rule) {
      try {
        setJdmContent(JSON.stringify(JSON.parse(rule.jdmContent), null, 2));
      } catch {
        setJdmContent(rule.jdmContent);
      }
      setIsActive(rule.isActive);
    }
  }, [rule]);

  const updateMutation = useMutation({
    mutationFn: async (data: { jdmContent?: string; isActive?: boolean }) => {
      return await apiClient.put(`/rules/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "rules"] });
      toast.success("Rule updated successfully");
      navigate({ to: "/admin/rules" });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update rule: ${error.message}`);
    },
  });

  const dryRunMutation = useMutation({
    mutationFn: async (data: { testData: Record<string, unknown> }) => {
      return await apiClient.post("/rules/evaluate", {
        entityName: rule?.entityName || "Account",
        operation: rule?.operation || "CREATE",
        data: data.testData,
      });
    },
    onSuccess: (result) => {
      setTestResult(result);
    },
    onError: (error: Error) => {
      setTestResult({ error: error.message });
    },
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};
    try {
      JSON.parse(jdmContent);
    } catch {
      newErrors.jdmContent = "Invalid JDM content";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    updateMutation.mutate({ jdmContent, isActive });
  };

  const handleDryRun = () => {
    try {
      const parsed = JSON.parse(testData);
      dryRunMutation.mutate({ testData: parsed });
    } catch {
      toast.error("Invalid test data JSON");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!rule) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Rule not found</p>
          <Link to="/admin/rules">
            <Button variant="outline" className="rounded-none">
              Back to Rules
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b-4 border-black bg-white">
        <div className="max-w-6xl mx-auto px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/admin/rules">
                <Button variant="ghost" size="sm" className="rounded-none">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-black">Edit Rule</h1>
                <p className="text-sm text-gray-600 mt-1">{rule.ruleName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="font-mono text-xs">
                v{rule.version}
              </Badge>
              <Badge
                variant={rule.operation === "ALL" ? "default" : "secondary"}
                className="text-xs"
              >
                {rule.operation}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {rule.entityName}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-8">
        <form onSubmit={handleSubmit}>
          {/* Rule metadata display (read-only) */}
          <div className="border-2 border-black mb-8">
            <div className="bg-gray-50 px-6 py-3 border-b-2 border-black">
              <h2 className="text-sm font-semibold uppercase tracking-wider">Rule Details</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-4 gap-6">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Entity
                  </Label>
                  <p className="mt-1 font-medium">{rule.entityName}</p>
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Operation
                  </Label>
                  <p className="mt-1 font-medium">{rule.operation}</p>
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Version
                  </Label>
                  <p className="mt-1 font-medium">v{rule.version}</p>
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Status
                  </Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                    <span
                      className={`text-sm font-medium ${isActive ? "text-emerald-600" : "text-gray-400"}`}
                    >
                      {isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6 mt-4 pt-4 border-t border-gray-100">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Created
                  </Label>
                  <p className="mt-1 text-sm text-gray-600">
                    {new Date(rule.createdAt).toLocaleString()}
                    {rule.createdBy && <span className="text-gray-400"> by {rule.createdBy}</span>}
                  </p>
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Last Updated
                  </Label>
                  <p className="mt-1 text-sm text-gray-600">
                    {new Date(rule.updatedAt).toLocaleString()}
                    {rule.updatedBy && <span className="text-gray-400"> by {rule.updatedBy}</span>}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Decision Table Editor */}
          <div className="border-2 border-black mb-8">
            <div className="bg-gray-50 px-6 py-3 border-b-2 border-black">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider">Decision Logic</h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-none text-xs"
                  onClick={() => setShowTestPanel(!showTestPanel)}
                >
                  <TestTube2 className="h-3.5 w-3.5 mr-1" />
                  {showTestPanel ? "Hide Test" : "Test Rule"}
                </Button>
              </div>
            </div>
            <RuleTableEditor
              name={rule.ruleName}
              table={asDecisionTable(jdmContent)}
              // Serialised on the way out. `jdmContent` is the JSON text the
              // rules API stores and every check on this page parses; the
              // editor hands back a DecisionTable object. Passing the setter
              // straight in put the object into a string state, so the save
              // path's JSON.parse threw and a rule authored in the table editor
              // could not be saved at all — it failed validation as "Invalid
              // JDM content" with nothing on screen to explain why.
              onChange={(next) => setJdmContent(JSON.stringify(next, null, 2))}
            />
            {errors.jdmContent && (
              <p className="text-xs text-red-600 px-4 pb-2">{errors.jdmContent}</p>
            )}
          </div>

          {/* Test Panel */}
          {showTestPanel && (
            <div className="border-2 border-black mb-8">
              <div className="bg-amber-50 px-6 py-3 border-b-2 border-black">
                <h2 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                  <TestTube2 className="h-4 w-4" />
                  Dry Run — Test Your Rule
                </h2>
                <p className="text-xs text-gray-600 mt-1">
                  Enter sample entity data to see how your rule would evaluate it.
                </p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 block">
                      Test Data (JSON)
                    </Label>
                    <textarea
                      className="w-full h-40 font-mono text-xs border-2 border-gray-300 p-3 rounded-none"
                      value={testData}
                      onChange={(e) => setTestData(e.target.value)}
                      placeholder={`{\n  "name": "Test Account",\n  "email": null,\n  "status": "active"\n}`}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="mt-2 rounded-none bg-amber-600 text-white hover:bg-amber-700"
                      onClick={handleDryRun}
                      disabled={dryRunMutation.isPending}
                    >
                      {dryRunMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <TestTube2 className="h-3.5 w-3.5 mr-1" />
                      )}
                      Run Test
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 block">
                      Result
                    </Label>
                    {testResult ? (
                      <div className="h-40 overflow-auto border-2 border-gray-200 p-3 bg-gray-50 text-xs">
                        {testResult.error ? (
                          <div className="flex items-start gap-2 text-red-600">
                            <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-semibold">Error</p>
                              <p>{testResult.error}</p>
                            </div>
                          </div>
                        ) : testResult.results?.length > 0 ? (
                          <div className="space-y-2">
                            {testResult.results.map((r: any, i: number) => (
                              <div
                                key={i}
                                className={`flex items-start gap-2 p-2 rounded ${
                                  r.actions?.some((a: any) => a.type === "prevent")
                                    ? "bg-red-50 text-red-700"
                                    : r.actions?.some((a: any) =>
                                          (a.type as string)?.startsWith("cascade")
                                        )
                                      ? "bg-blue-50 text-blue-700"
                                      : "bg-amber-50 text-amber-700"
                                }`}
                              >
                                {r.actions?.some((a: any) => a.type === "prevent") ? (
                                  <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                ) : r.actions?.some((a: any) =>
                                    (a.type as string)?.startsWith("cascade")
                                  ) ? (
                                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                ) : (
                                  <HelpCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                )}
                                <div>
                                  <p className="font-semibold">{r.ruleName}</p>
                                  {r.actions?.map((a: any, j: number) => (
                                    <p key={j}>
                                      [{a.type}] {a.config?.message}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            <span className="font-semibold">All checks passed — no violations</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-40 border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 text-xs">
                        Click "Run Test" to see results
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Link to="/admin/rules">
              <Button
                type="button"
                variant="outline"
                className="rounded-none border-2 border-black"
              >
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="bg-black text-white hover:bg-gray-800 rounded-none px-8"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
