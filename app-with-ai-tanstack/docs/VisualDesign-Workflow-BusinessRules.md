# Visual Designer for Rules & Business Workflows

A complete architecture plan for a two-designer system: **GoRules** for business decisions, and a **visual BPMN action graph** (`bpmn-js`) for orchestrating side effects — executed by your own TypeScript BPMN runtime inside a single database transaction. **Trigger.dev** orchestrates the save: the record is persisted as **Draft** first, then promoted to **Final** only if every rule and action succeeds — otherwise it stays in Draft with the errors attached.

---

## Core Principle

> **GoRules tells you _what_ should happen.**
> **The BPMN action graph tells you _how_ it happens.**

Keep these two concerns strictly separate. The rule engine makes decisions and calculations; it never touches the database. A separate action layer performs persistence and side effects. This separation keeps rules reusable, testable, and independent of your persistence layer.

---

## The Two Designers

### Designer 1 — Rules (GoRules)

The rule engine evaluates conditions and produces a **decision context** — plain values, no side effects.

**Input conditions:**

```
Customer.Type == Gold
AND
Order.Total > 10000
```

**Outputs (decision context):**

```
IsGold        = true
NeedsApproval = false
Discount      = 15
```

### Designer 2 — Actions (`bpmn-js`)

A single visual designer built on **`bpmn-js`**. No React Flow. Workflows are authored as standard BPMN and serialized to BPMN XML.

- **Designer:** `bpmn-js`
- **Storage:** BPMN XML
- **Runtime:** your own TypeScript BPMN executor
- **Node registry:** `UpdateEntity`, `CreateEntity`, `DeleteEntity`, `Formula`, `Loop`, `SQL`, `REST`, `Agent`, etc.
- **Execution:** runs inside the same database transaction as the save, so updates are atomic.

The action graph consumes the decision context and orchestrates updates and side effects, in order:

```
        Customer Saved
              │
              ▼
   Update Customer.Discount
              │
              ▼
   Update Account.CreditLimit
              │
              ▼
       Create Audit
              │
              ▼
       Call AI Agent
```

---

## Why Separate Rules from Persistence

**Do not** let GoRules update the database directly. Avoid rules like:

```
Update Customer    ← ❌ don't do this inside the rule engine
```

**Instead**, split the decision from the action:

```
Decision:
    Discount = 15

Action:
    Update Customer.Discount
```

**Benefits of this separation:**

- **Reusable** — the same rule can drive different actions in different contexts.
- **Testable** — decisions are pure functions of input; you can unit-test them with no database.
- **Persistence-independent** — swapping or refactoring your data layer doesn't touch your rules.
- **Auditable** — the decision context is an explicit, inspectable artifact.

---

## Target Architecture

```
                 Save()
                   │
                   ▼
        Persist record as DRAFT
                   │
                   ▼
            Trigger.dev Task
        (durable, retryable orchestration)
                   │
                   ▼
          Begin DB Transaction
                   │
                   ▼
            Rule Engine
             (GoRules)
                   │
            Decision Context
                   ▼
        BPMN Executor (TypeScript)
        parses & runs BPMN XML
                   │
       UpdateEntity()   Formula()
       CreateEntity()   Loop()
       DeleteEntity()   SQL()
       REST()           Agent()
                   │
            ┌──────┴───────┐
        success         failure
            │               │
            ▼               ▼
   Commit + status=    Roll back +
       FINAL          status=DRAFT
                      + attach errors
```

**Execution flow:**

1. `Save()` **persists the record immediately in `DRAFT` status**, then enqueues a **Trigger.dev task** for it. The record always exists from the moment of save; only its status changes. Trigger.dev gives you durability, retries, and observability for the whole operation.
2. Inside the task, the executor **opens a single database transaction**.
3. The **Rule Engine (GoRules)** evaluates and produces a **Decision Context**.
4. The **BPMN Executor** parses the stored BPMN XML and walks the graph, executing each node against the decision context.
5. All entity operations (`UpdateEntity`, `CreateEntity`, `DeleteEntity`, `Formula`, `Loop`, `SQL`, `REST`, `Agent`, …) run inside the same transaction.
6. **On success:** the transaction commits and the record transitions to **`FINAL`**.
7. **On failure:** the transaction rolls back (so no partial side effects survive) and the record **stays in `DRAFT`**, with the captured error(s) attached so the user can see what went wrong and fix it.

> **Transaction boundary note:** A DB transaction cannot span across the Trigger.dev worker boundary. The Trigger.dev *task* is the unit that opens, runs, and commits the single transaction. Trigger.dev handles orchestration and retries; the executor inside the task owns atomicity. The initial `DRAFT` write happens *before* the task is enqueued, so it is never rolled back by a failed run.

---

## Draft → Final Lifecycle

The save is split into two phases so the record is never lost and the user always has a clear signal of what happened.

### State machine

```
            Save()
              │
              ▼
         ┌─────────┐   rules + actions succeed    ┌─────────┐
         │  DRAFT  │ ───────────────────────────▶ │  FINAL  │
         └─────────┘                              └─────────┘
              ▲                                        │
              │         rules or actions fail          │
              └────────────────────────────────────────┘
                   (stay/return to DRAFT + errors)
```

- **`DRAFT`** — the record exists and is editable. This is the landing state on every save and the fallback state on every failure.
- **`FINAL`** — the record passed all business rules and every action committed. Reached only on a clean, fully-committed run.

### Phase 1 — Save (synchronous)

`Save()` writes the record as `DRAFT` and returns immediately. This write is **not** part of the action transaction, so it survives no matter what the task does next. The user gets instant feedback that their input was stored, and a task is queued.

### Phase 2 — Promote (Trigger.dev task)

The Trigger.dev task runs the **extra business rules and actions** that define `FINAL`:

- **If everything succeeds** → commit the transaction and set `status = FINAL`.
- **If anything fails** (a rule rejects, a validation fails, an action throws) → roll back the transaction and set `status = DRAFT`, attaching the error details so the user can see exactly what happened and correct it.

Because the promotion runs inside a single DB transaction, a failure leaves **no partial side effects** — the credit limit, audit row, agent call, etc. either all happened together (→ `FINAL`) or none of them did (→ back to `DRAFT`).

### Capturing what happened

On failure, persist the error(s) onto the record (outside the rolled-back transaction) so they're visible in the UI:

```typescript
interface RecordStatus {
    status: "DRAFT" | "FINAL";
    promotedAt?: Date;
    errors?: WorkflowError[];   // populated when a promotion fails
}

interface WorkflowError {
    nodeId?: string;       // which BPMN node failed (if applicable)
    rule?: string;         // which GoRules decision rejected (if applicable)
    message: string;       // human-readable explanation
    detail?: unknown;      // stack / payload for debugging
}
```

Promotion logic, sketched:

```typescript
export const promoteRecord = task({
    id: "promote-record",
    run: async ({ recordId }: { recordId: string }) => {
        try {
            await db.transaction(async (tx) => {
                const decision = await runRules(recordId, tx);      // GoRules
                await runBpmnGraph(recordId, decision, tx);         // BPMN executor
                await tx.update("Record", recordId, {
                    status: "FINAL",
                    promotedAt: new Date(),
                    errors: null,
                });
            }); // commit on success, rollback on throw
        } catch (err) {
            // Transaction already rolled back — record changes are undone.
            // Write status + errors in a separate, non-rolled-back statement.
            await db.update("Record", recordId, {
                status: "DRAFT",
                errors: toWorkflowErrors(err),
            });
        }
    },
});
```

### Re-running

Because the record stays in `DRAFT` with its errors, the user (or a retry) can fix the inputs and save again, re-triggering the promotion. `FINAL` is only ever reached through a fully successful run, so the state is always trustworthy.

---

## Node Model

Each node in the BPMN graph maps to a registered TypeScript class implementing a common interface:

```typescript
interface ActionNode {
    execute(ctx: WorkflowContext): Promise<void>;
}
```

The entire graph is executed within the same database transaction, so either all side effects apply or none do — guaranteeing transactional consistency.

### Node registry

The executor resolves BPMN element types to node implementations via a registry:

```typescript
type NodeFactory = (props: Record<string, unknown>) => ActionNode;

const nodeRegistry: Record<string, NodeFactory> = {
    UpdateEntity: (p) => new UpdateEntityNode(p),
    CreateEntity: (p) => new CreateEntityNode(p),
    DeleteEntity: (p) => new DeleteEntityNode(p),
    Formula:      (p) => new FormulaNode(p),
    Loop:         (p) => new LoopNode(p),
    SQL:          (p) => new SqlNode(p),
    REST:         (p) => new RestNode(p),
    Agent:        (p) => new AgentNode(p),
    // extend freely…
};
```

Each BPMN task in the XML carries a node type (e.g. via an extension attribute) plus its properties; the executor looks the type up in the registry and instantiates the node.

### Example node implementations (sketch)

```typescript
class UpdateEntityNode implements ActionNode {
    constructor(private props: { entity: string; field: string; source: string }) {}

    async execute(ctx: WorkflowContext): Promise<void> {
        const value = ctx.decision[this.props.source];
        await ctx.tx.update(this.props.entity, { [this.props.field]: value });
    }
}

class FormulaNode implements ActionNode {
    constructor(private props: { target: string; expression: string }) {}

    async execute(ctx: WorkflowContext): Promise<void> {
        ctx.vars[this.props.target] = evaluate(this.props.expression, ctx);
    }
}

class LoopNode implements ActionNode {
    constructor(private props: { collection: string; body: ActionNode[] }) {}

    async execute(ctx: WorkflowContext): Promise<void> {
        const items = ctx.vars[this.props.collection] as unknown[];
        for (const item of items) {
            for (const node of this.props.body) {
                await node.execute({ ...ctx, item });
            }
        }
    }
}

class SqlNode implements ActionNode {
    constructor(private props: { statement: string }) {}

    async execute(ctx: WorkflowContext): Promise<void> {
        await ctx.tx.execute(this.props.statement, ctx.vars);
    }
}

class RestNode implements ActionNode {
    constructor(private props: { url: string; method: string }) {}

    async execute(ctx: WorkflowContext): Promise<void> {
        // External call — see "side effects that must not roll back" note below.
        await ctx.http.request(this.props.method, this.props.url, ctx.vars);
    }
}

class AgentNode implements ActionNode {
    constructor(private props: { agentId: string }) {}

    async execute(ctx: WorkflowContext): Promise<void> {
        await ctx.agents.invoke(this.props.agentId, ctx.decision);
    }
}
```

### Suggested `WorkflowContext`

```typescript
interface WorkflowContext {
    entityId: string;
    decision: Record<string, unknown>;  // the GoRules decision context
    vars: Record<string, unknown>;      // working memory for Formula/Loop/etc.
    tx: TransactionHandle;              // the active DB transaction
    http: HttpClient;                   // for REST nodes
    agents: AgentRegistry;              // for Agent nodes
    item?: unknown;                     // current element inside a Loop
}
```

---

## Recommended Stack

| Layer | Technology | Responsibility |
|---|---|---|
| **Decisions** | GoRules | Business decisions and calculations (pure, no side effects) |
| **Designer** | `bpmn-js` | Visual BPMN authoring; serialized to BPMN XML |
| **Storage** | BPMN XML | Canonical, portable representation of each workflow |
| **Runtime** | TypeScript BPMN executor | Parses BPMN XML, resolves nodes via the registry, runs the graph |
| **Orchestration** | Trigger.dev | Durable, retryable task that wraps the save and owns the transaction lifecycle |
| **Atomicity** | Single DB transaction (inside the task) | All entity operations commit or roll back together |

This gives developers a clear visual model of which entities are updated and in what order, while keeping business rules separate from persistence and maintaining transactional consistency. Trigger.dev adds durability, retries, and observability around the whole save.

---

## Why This Holds Up Over Time

Because the designer stores plain BPMN XML and the runtime resolves nodes through a registry, new capabilities are just new entries in `nodeRegistry` — the rules layer, the BPMN format, and the transaction model stay untouched:

- **REST calls** — already modeled via the `REST` node.
- **AI agents** — already modeled via the `Agent` node.
- **Notifications** — email, push, webhooks as additional node types.
- **Asynchronous tasks** — enqueue follow-up Trigger.dev tasks to run *after* commit (kept deliberately outside the transaction so they don't block the commit or get rolled back).

---

## Design Rules of Thumb

1. **Rules never write.** GoRules produces values; the BPMN graph writes them.
2. **Save lands in Draft; promotion reaches Final.** The synchronous save always writes `DRAFT`; only a fully successful Trigger.dev promotion sets `FINAL`. Failure returns to `DRAFT` with errors attached.
3. **One transaction per promotion.** The whole graph commits or rolls back atomically, inside the Trigger.dev task. The initial `DRAFT` write sits outside that transaction so it's never lost.
3. **Trigger.dev orchestrates; the executor owns the transaction.** Don't try to stretch a DB transaction across worker boundaries.
4. **Nodes are small and composable.** One responsibility per `ActionNode`; register the type, implement `execute`.
5. **Side effects that must not roll back** (emails, non-idempotent external REST calls, downstream tasks) run *after* commit — typically as a follow-up Trigger.dev task — not inside the transaction.
6. **BPMN XML is the source of truth.** The designer and the runtime agree on it; version it like code.
7. **The decision context is the contract** between the two designers — keep it explicit and serializable.