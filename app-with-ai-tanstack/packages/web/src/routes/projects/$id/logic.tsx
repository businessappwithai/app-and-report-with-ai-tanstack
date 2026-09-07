import { CopilotSidebar } from "@copilotkit/react-ui";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  GitBranch,
  ListOrdered,
  Loader2,
  Plus,
  Save,
  Trash2,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AutomationBuilder } from "@/components/automation/AutomationBuilder";
import { CopilotProvider } from "@/components/CopilotProvider";
import { type EditableRule, RuleEditor, slugifyRuleName } from "@/components/eml/RuleEditor";
import { emptyStateFlow } from "@/components/eml/StateFlowCanvas";
import {
  type EditableWorkflow,
  emitWorkflowDiagram,
  emptyWorkflow,
  pascalWorkflowName,
  WorkflowEditor,
  type WorkflowKind,
} from "@/components/eml/WorkflowEditor";
import { ProgressStepper } from "@/components/ProgressStepper";
import { WizardStepHeader } from "@/components/WizardStepHeader";
import { useModelAssistant } from "@/hooks/useModelAssistant";
import { parseAutomation } from "@/lib/automation/model";
import {
  emptyDecisionTable,
  parseTableFromFlowchart,
  tableToEmlFlowchart,
} from "@/lib/eml/decision-table";
import {
  emptySagaFlow,
  parseHookWorkflow,
  parseSagaFlow,
  parseStateFlow,
} from "@/lib/eml/workflow-flow";
import { requestContext } from "@/lib/request-context";
import { useProjectStore } from "@/store/projectStore";

/**
 * Rules and workflows, on one screen.
 *
 * These were two wizard steps, which said they were two jobs done in order:
 * finish all the deciding, then start all the doing. They are not. A rule
 * decides and a process acts on what it decided — often about the same entity,
 * now often as a Decision step inside the process itself. Splitting them meant
 * naming a rule on one screen and typing that name from memory on another.
 *
 * One rail lists both. One save writes both into the model in a single edit,
 * which also fixes a real hazard: each page used to send its own half and
 * re-read the other from the document, so two tabs could quietly undo each
 * other.
 */

async function checkAuthMe() {
  const { baseUrl, fetchInit } = await requestContext();
  const res = await fetch(`${baseUrl}/api/auth/me`, fetchInit);
  return res.json() as Promise<{ user: { id: string; email: string; role: string } | null }>;
}

export const Route = createFileRoute("/projects/$id/logic")({
  beforeLoad: async () => {
    try {
      const data = await checkAuthMe();
      if (!data.user) throw redirect({ to: "/login" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
      throw redirect({ to: "/login" });
    }
  },
  component: LogicRoute,
});

/**
 * The provider has to sit above the component that calls the Copilot hooks —
 * rendering it inside LogicPage's own JSX puts the context below the consumer
 * and throws "useCopilotKit must be used within CopilotKitProvider".
 */
function LogicRoute() {
  return (
    <CopilotProvider>
      <LogicPage />
      <CopilotSidebar
        labels={{
          title: "Rules and processes",
          initial:
            "I can see this application's entities, its rules and its processes, and the EML " +
            "language they are written in. Ask me what already runs on an entity, or describe " +
            "the behaviour you want and I will tell you which rule or step declares it.",
        }}
        defaultOpen={false}
        clickOutsideToClose={false}
      />
    </CopilotProvider>
  );
}

type Selection = { kind: "rule" | "workflow"; index: number };

interface EmlResponse {
  eml: string;
  rules: Array<{
    name: string;
    entity: string;
    event: string;
    priority?: number;
    title?: string;
    flowchart: string;
  }>;
  workflows: Array<{
    name: string;
    entity: string;
    kind: string;
    trigger?: "automatic" | "rule";
    operation?: "CREATE" | "UPDATE" | "DELETE" | "ALL";
    title?: string;
    diagram: string;
  }>;
}

/** Entity names and their attributes, read from the ERD for the pickers. */
function readEntities(erd: string): Array<{ name: string; attributes: string[] }> {
  const entities: Array<{ name: string; attributes: string[] }> = [];
  let current: { name: string; attributes: string[] } | null = null;

  for (const rawLine of (erd ?? "").split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("%%")) continue;

    const open = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*\{$/);
    if (open?.[1]) {
      current = { name: open[1], attributes: [] };
      continue;
    }
    if (line === "}" && current) {
      entities.push(current);
      current = null;
      continue;
    }
    if (current) {
      const attribute = line.match(/^[A-Za-z][\w[\]]*\s+([A-Za-z_]\w*)/);
      if (attribute?.[1]) current.attributes.push(attribute[1]);
    }
  }
  return entities;
}

let keyCounter = 0;
const nextKey = () => `k${(keyCounter++).toString(36)}${Date.now().toString(36)}`;

function LogicPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { currentProject, loadProject, setCurrentStep } = useProjectStore();

  const [rules, setRules] = useState<EditableRule[]>([]);
  const [workflows, setWorkflows] = useState<EditableWorkflow[]>([]);
  const [erd, setErd] = useState("");
  const [selected, setSelected] = useState<Selection>({ kind: "rule", index: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) void loadProject(id);
  }, [id, loadProject]);

  useEffect(() => {
    setCurrentStep("logic");
  }, [setCurrentStep]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`/api/projects/${id}/eml`);
        if (!response.ok) throw new Error(`Could not load the model (${response.status})`);
        const data = (await response.json()) as EmlResponse;
        if (cancelled) return;

        setErd(data.eml ?? "");
        setRules(
          (data.rules ?? []).map((rule) => {
            // Only tables this editor wrote round-trip through the
            // %%decision-table directive. A hand-authored flowchart parses to
            // null, and blanking it here would hand the save path an empty
            // table to overwrite the real logic with — so keep the source.
            const table = parseTableFromFlowchart(rule.flowchart);
            return {
              key: nextKey(),
              name: rule.name,
              entity: rule.entity,
              event: rule.event,
              priority: rule.priority,
              title: rule.title,
              table: table ?? emptyDecisionTable(),
              ...(table ? {} : { sourceFlowchart: rule.flowchart }),
            };
          })
        );
        setWorkflows(
          (data.workflows ?? []).map((workflow) => {
            const kind: WorkflowKind =
              workflow.kind === "state" || workflow.kind === "saga" ? workflow.kind : "hook";
            const saga = kind === "saga" ? parseSagaFlow(workflow.diagram) : emptySagaFlow();
            return {
              key: nextKey(),
              name: workflow.name,
              entity: workflow.entity,
              kind,
              title: workflow.title,
              hooks: kind === "hook" ? parseHookWorkflow(workflow.diagram) : [],
              states: kind === "state" ? parseStateFlow(workflow.diagram) : emptyStateFlow(),
              // A hook workflow is many handlers on different events, which is
              // the multi-trigger shape the automation ladder now carries. It
              // reads and writes the same `%%hook` directives, so this is a
              // change of editor, not of artifact.
              ...(kind === "hook" || kind === "saga"
                ? {
                    automation: {
                      ...parseAutomation(workflow.diagram, workflow.entity),
                      kind,
                      name: workflow.title ?? workflow.name,
                      trigger: {
                        ...parseAutomation(workflow.diagram, workflow.entity).trigger,
                        entity: workflow.entity,
                      },
                      // For a saga these ride on the %%workflow directive, so
                      // they reach us beside the diagram rather than inside it.
                      ...(kind === "saga"
                        ? {
                            // Absent means automatic: language/composer.ts only
                            // ever writes the token for `rule`, so falling back
                            // to the SagaFlow default ("rule") relabelled every
                            // automatic saga as rule-triggered.
                            sagaTrigger: workflow.trigger ?? "automatic",
                            sagaOperation: workflow.operation ?? saga.operation,
                          }
                        : {}),
                    },
                  }
                : {}),
              // The diagram carries the steps; the trigger lives on the
              // %%workflow directive, so it arrives alongside rather than inside.
              saga: {
                ...saga,
                trigger: workflow.trigger ?? saga.trigger,
                operation: workflow.operation ?? saga.operation,
              },
            };
          })
        );
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load the model");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    if (id) void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const entities = useMemo(() => readEntities(erd), [erd]);
  const entityNames = useMemo(() => entities.map((entity) => entity.name), [entities]);
  const columnsFor = useCallback(
    (entity: string) => entities.find((candidate) => candidate.name === entity)?.attributes ?? [],
    [entities]
  );
  /** The same fields `columnsFor` gives, in the shape the ladder takes them. */
  const entityFieldMap = useMemo(
    () => Object.fromEntries(entities.map((entity) => [entity.name, entity.attributes])),
    [entities]
  );
  // A Decision step can evaluate a rule declared here rather than carrying its
  // own copy of the same table — which is only offerable because both live on
  // this screen now.
  const ruleNames = useMemo(
    () => rules.map((rule) => slugifyRuleName(rule.title ?? rule.name)),
    [rules]
  );

  // What is on this screen is names and canvases; the decision tables, step
  // properties and directive syntax the assistant needs to answer a question
  // about them come from retrieval.
  useModelAssistant({
    projectId: id,
    surface: "logic",
    summary: useMemo(
      () => ({
        name: currentProject?.name ?? "this application",
        entities: entities.map((entity) => entity.name),
        ruleNames,
        workflowNames: workflows.map((workflow) =>
          pascalWorkflowName(workflow.title ?? workflow.name)
        ),
      }),
      [currentProject?.name, entities, ruleNames, workflows]
    ),
  });

  const activeRule = selected.kind === "rule" ? (rules[selected.index] ?? null) : null;
  const activeWorkflow = selected.kind === "workflow" ? (workflows[selected.index] ?? null) : null;

  const patchRule = useCallback(
    (patch: Partial<EditableRule>) => {
      setRules((current) =>
        current.map((rule, index) => (index === selected.index ? { ...rule, ...patch } : rule))
      );
      setSavedAt(null);
    },
    [selected.index]
  );

  const patchWorkflow = useCallback(
    (patch: Partial<EditableWorkflow>) => {
      setWorkflows((current) =>
        current.map((workflow, index) =>
          index === selected.index ? { ...workflow, ...patch } : workflow
        )
      );
      setSavedAt(null);
    },
    [selected.index]
  );

  const addRule = () => {
    setRules((current) => [
      ...current,
      {
        key: nextKey(),
        name: `rule${rules.length + 1}`,
        entity: entityNames[0] ?? "",
        event: "beforeCreate",
        priority: 100,
        table: emptyDecisionTable(),
      },
    ]);
    setSelected({ kind: "rule", index: rules.length });
    setSavedAt(null);
  };

  const addWorkflow = (kind: WorkflowKind) => {
    setWorkflows((current) => [...current, emptyWorkflow(kind, nextKey(), entityNames[0] ?? "")]);
    setSelected({ kind: "workflow", index: workflows.length });
    setSavedAt(null);
  };

  const removeAt = (kind: "rule" | "workflow", index: number) => {
    if (kind === "rule") setRules((current) => current.filter((_r, i) => i !== index));
    else setWorkflows((current) => current.filter((_w, i) => i !== index));
    setSelected((current) =>
      current.kind === kind && current.index >= index
        ? { kind, index: Math.max(0, current.index - 1) }
        : current
    );
    setSavedAt(null);
  };

  /** One write, both halves — the document is edited once. */
  const save = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${id}/eml`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: rules.map((rule) => ({
            name: slugifyRuleName(rule.title ?? rule.name),
            entity: rule.entity,
            event: rule.event,
            priority: rule.priority,
            title: rule.title,
            // An unconverted hand-authored rule goes back exactly as it came
            // in. Re-emitting from `table` would write a blank table over it.
            flowchart: rule.sourceFlowchart ?? tableToEmlFlowchart(rule.table),
          })),
          workflows: workflows.map((workflow) => ({
            name: pascalWorkflowName(workflow.title ?? workflow.name),
            entity: workflow.entity,
            kind: workflow.kind,
            title: workflow.title,
            ...(workflow.kind === "saga"
              ? {
                  trigger: workflow.automation?.sagaTrigger ?? workflow.saga.trigger,
                  operation: workflow.automation?.sagaOperation ?? workflow.saga.operation,
                }
              : {}),
            diagram: emitWorkflowDiagram(workflow),
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? `Save failed (${response.status})`);

      setErd(data.eml ?? erd);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save");
    } finally {
      setIsSaving(false);
    }
  };

  const kindIcon = (kind: WorkflowKind) =>
    kind === "saga" ? ListOrdered : kind === "state" ? GitBranch : WorkflowIcon;

  return (
    <div className="min-h-screen bg-background">
      <ProgressStepper currentStep="logic" projectId={id} />

      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <WizardStepHeader
          stepNumber={3}
          estimatedTime="10-15 min"
          subtitle={currentProject?.name}
          title="Rules and processes"
          description="The decisions your application makes, and what happens around them. A rule compiles to a GoRules decision graph; a process runs steps in order and can carry a decision table inside one of them."
        />

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading the model…
          </div>
        ) : (
          <div className="flex gap-4">
            <aside className="w-64 shrink-0 space-y-5">
              {/* Rules */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Rules ({rules.length})
                  </h2>
                  <button
                    type="button"
                    onClick={addRule}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
                  >
                    <Plus className="h-3 w-3" />
                    New
                  </button>
                </div>

                <div className="space-y-1">
                  {rules.map((rule, index) => (
                    <div
                      key={rule.key}
                      className={`group flex items-center gap-1 rounded-md border px-2 py-1.5 text-left text-sm ${
                        selected.kind === "rule" && selected.index === index
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelected({ kind: "rule", index })}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate font-medium">
                          {rule.title || rule.name}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {rule.entity || "no entity"} · {rule.event}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAt("rule", index)}
                        aria-label={`Delete ${rule.name}`}
                        className="opacity-0 transition group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  ))}

                  {!rules.length && (
                    <p className="rounded-md border border-dashed border-border px-2 py-3 text-center text-xs text-muted-foreground">
                      No rules yet.
                    </p>
                  )}
                </div>
              </div>

              {/* Processes */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Processes ({workflows.length})
                  </h2>
                </div>
                <div className="mb-2 flex flex-wrap gap-1">
                  {(
                    [
                      ["hook", "Lifecycle"],
                      ["state", "Status"],
                      ["saga", "Process"],
                    ] as [WorkflowKind, string][]
                  ).map(([kind, label]) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => addWorkflow(kind)}
                      className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
                    >
                      <Plus className="h-3 w-3" />
                      {label}
                    </button>
                  ))}
                </div>

                <div className="space-y-1">
                  {workflows.map((workflow, index) => {
                    const Icon = kindIcon(workflow.kind);
                    return (
                      <div
                        key={workflow.key}
                        className={`group flex items-center gap-1 rounded-md border px-2 py-1.5 text-left text-sm ${
                          selected.kind === "workflow" && selected.index === index
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelected({ kind: "workflow", index })}
                          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {workflow.title || workflow.name}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {workflow.entity || "no entity"} · {workflow.kind}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAt("workflow", index)}
                          aria-label={`Delete ${workflow.name}`}
                          className="opacity-0 transition group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    );
                  })}

                  {!workflows.length && (
                    <p className="rounded-md border border-dashed border-border px-2 py-3 text-center text-xs text-muted-foreground">
                      No processes yet.
                    </p>
                  )}
                </div>
              </div>
            </aside>

            <div className="min-w-0 flex-1">
              {activeRule ? (
                <RuleEditor
                  key={activeRule.key}
                  rule={activeRule}
                  entities={entities}
                  projectId={id}
                  onChange={patchRule}
                  onError={setError}
                />
              ) : (activeWorkflow?.kind === "hook" || activeWorkflow?.kind === "saga") &&
                activeWorkflow.automation ? (
                // Hook workflows are edited in the same ladder the generated
                // application ships, so the two surfaces look and behave alike.
                <div className="min-h-[560px] overflow-hidden rounded-xl border border-border">
                  <AutomationBuilder
                    key={activeWorkflow.key}
                    automation={activeWorkflow.automation}
                    onChange={(automation) =>
                      patchWorkflow({
                        automation,
                        entity: automation.trigger.entity,
                        title: automation.name,
                        name: pascalWorkflowName(automation.name),
                      })
                    }
                    entities={entityNames}
                    entityFields={entityFieldMap}
                  />
                </div>
              ) : activeWorkflow ? (
                <WorkflowEditor
                  key={activeWorkflow.key}
                  workflow={activeWorkflow}
                  entityNames={entityNames}
                  ruleNames={ruleNames}
                  columnsFor={columnsFor}
                  onChange={patchWorkflow}
                />
              ) : (
                <div className="rounded-lg border border-dashed border-border py-20 text-center text-sm text-muted-foreground">
                  Pick a rule or a process on the left, or add one.
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {savedAt && (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Saved to the model at {savedAt}
              </>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate({ to: "/projects/$id/design", params: { id } })}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium"
            >
              Back to the data model
            </button>
            <button
              type="button"
              onClick={save}
              disabled={isSaving || isLoading}
              className="flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </button>
            <button
              type="button"
              onClick={async () => {
                await save();
                void navigate({ to: "/projects/$id/generate", params: { id } });
              }}
              disabled={isSaving || isLoading}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Continue to generate
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
