# Consent — dossier

Phase 4, entity 16 of 30. **Standalone**, and added at Gate A where you chose a
consent record per procedure over a flag.

## Why standalone rather than a child of `Procedure`

§10.2 question 1 answers *yes*: "show me every consent recorded today" is an
audit screen someone really opens, and it crosses procedures. That is also the
reason the record exists at all.

## 1 · Fields

| Column | Type | Modifiers | Help |
|---|---|---|---|
| `id` | string | PK | — |
| `procedure_id` | string | FK, required | The procedure being consented to. |
| `consent_type` | string | required, enum | How consent was given and recorded. |
| `giver_type` | string | required, enum | In what capacity consent was given — the patient themselves, or someone entitled to consent on their behalf. |
| `giver_name` | string | required | The name of the person who consented, as they signed it. |
| `witnessed_by_id` | string | FK, required | The member of staff who witnessed it. Required: an unwitnessed consent is not a consent. |
| `consented_at` | datetime | required | When it was given. |
| `is_withdrawn` | boolean | required | Consent can be withdrawn at any time up to the procedure, and withdrawal must be as easy to record as consent. |
| `withdrawn_at` | datetime | optional | When it was withdrawn. Empty unless it was. |
| `notes` | text | optional | What was explained, and anything the patient asked. |

## 2 · Enums

```
%%enum ConsentType: written, verbal, implied, electronic
%%enum ConsentGiver: patient, next_of_kin, legal_guardian, court_order
```

`giver_type` was written `given_by` first, and the checker was right to object:
`EML119` reads a `_by` suffix as a reference to a member of staff, and a column
the dictionary would then render as a broken lookup is worse than one named
plainly. The name changed; the meaning did not.

`ConsentGiver` carries real weight: a consent given by a guardian for a child,
or under a court order, is legally different from one the patient gave, and an
auditor asks which it was.

## 3 · Relationships

In: `Procedure`, `Staff` (the witness).

**No direct link to `Patient`.** It resolves through
`Consent → Procedure → Encounter → Patient`, which is one path rather than two.
A second, direct `patient_id` would be a path that could disagree with the
first — a consent attached to procedure A but patient B — and nothing would
catch it.

## 4 · Lifecycle

**None.** `is_withdrawn` carries the only change a consent record undergoes, and
it is one-way. A withdrawn consent is not re-given; a new consent is recorded.

## 5 · Rules · 6 · Hooks

**None here.** The gate is on `Procedure`, where the write it guards happens.

## 7 · Cross-entity effects

Withdrawing consent should stop a `consented` procedure proceeding.
`procedureConsentGate` covers the forward direction; the reverse — a procedure
already `consented` whose consent is then withdrawn — is noted for Phase 5.

## 8 · Access

read: `doctor`, `nurse`, `hospital_manager`, `administrator` — the hospital
manager is here for the audit screen this entity exists to serve ·
create: `doctor`, `nurse` · update: `doctor`, `nurse` (to withdraw) ·
delete: `administrator` only — a consent record is evidence

---

## Phase 6 repair — what Phase 6 changed here

Nothing on this entity. `unconsentProcedure` reads `isWithdrawn`, a column of
the consent record itself, so it fires.
