# Procedure — dossier

Phase 4, entity 15 of 30. **Child of `Encounter`** — see `ClinicalNote.md`. The
thing `Consent` attaches to.

## 1 · Fields

| Column | Type | Modifiers | Help |
|---|---|---|---|
| `id` | string | PK | — |
| `encounter_id` | string | FK, required | The contact this was done during. |
| `doctor_id` | string | FK, required | The doctor who performed it and is accountable for it. |
| `procedure_code` | string | required | The classification code, which is what billing prices from. |
| `name` | string | required | What was done, in words. |
| `status` | string | required, enum | Where the procedure has got to. |
| `scheduled_for` | datetime | optional | When it is planned for. Empty for something done there and then. |
| `performed_at` | datetime | optional | When it was actually done. Empty until it is. |
| `anaesthetic_type` | string | optional, enum | What anaesthetic was used, if any. |
| `outcome` | text | optional | What happened, including complications. |

## 2 · Enums

```
%%enum ProcedureStatus: planned, consented, in_progress, completed, abandoned, cancelled
%%enum AnaestheticType: none, local, regional, sedation, general
```

## 4 · Lifecycle — `ProcedureLifecycle`

```
[*] --> planned
planned    --> consented  : obtain_consent
planned    --> cancelled  : cancel
consented  --> in_progress : begin
consented  --> cancelled  : cancel
in_progress --> completed : complete
in_progress --> abandoned : abandon
completed --> [*]
abandoned --> [*]
cancelled --> [*]
```

**There is no edge from `planned` to `in_progress`.** A procedure cannot begin
without passing through `consented`. That is the whole reason `Consent` was made
a record rather than a flag at Gate A: the state machine makes the consent step
structurally unskippable, and the rule below makes it truthful.

## 5 · Rules

**`procedureConsentGate`** on `beforeUpdate`, and it must **act**: refuse the
move to `consented` unless a `Consent` record exists for this procedure that has
not been withdrawn.

Without this rule the state machine only enforces that someone *clicked*
consent. With it, the click has to correspond to a record.

## 6 · Hooks

**None.**

## 7 · Cross-entity effects

A completed procedure becomes a chargeable line on the invoice. Saga at Phase 5.

## 8 · Access

read: `doctor`, `nurse`, `billing_clerk`, `administrator` — billing prices from
the procedure code, as with `Diagnosis` · create/update: `doctor`, `nurse` ·
`begin`/`complete`/`abandon`: `doctor` only

---

## Phase 6 repair — `procedureConsentGate` became a handler

Both actions read the procedure's consent rows — `consentCount` and
`consentWithdrawn` — which the rules engine cannot see. The rule is gone and the
check is `%%hook beforeUpdate requireConsentBeforeConsented on Procedure`.

The **withdrawal** half is still enforced in the model, and by a stronger
mechanism than the rule was: `ConsentWithdrawal` takes the procedure back to
`planned` the moment consent is withdrawn, so a withdrawn consent cannot leave a
procedure sitting in `consented` at all.
