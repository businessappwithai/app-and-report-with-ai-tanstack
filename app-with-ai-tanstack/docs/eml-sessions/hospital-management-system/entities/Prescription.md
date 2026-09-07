# Prescription — dossier

Phase 4, entity 22 of 30. **Standalone**, Pharmacy. The entity where §7 of the
research's segregation-of-duties requirement becomes a refusal rather than a
policy.

## 1 · Fields

| Column | Type | Modifiers | Help |
|---|---|---|---|
| `id` | string | PK | — |
| `prescription_number` | string | UK, required | Pharmacy's own number. Generated, never typed. |
| `encounter_id` | string | FK, required | The contact it was written during. |
| `prescribed_by_id` | string | FK, required | Who wrote it. |
| `status` | string | required, enum | Where it has got to. Driven by the lifecycle. |
| `is_discharge_prescription` | boolean | required | Taken home rather than given on the ward. Dispensed differently, and it goes on the discharge summary. |
| `prescribed_at` | datetime | required | When it was written. |
| `verified_by_id` | string | FK, optional | The pharmacist who checked it. |
| `verified_at` | datetime | optional | When. |
| `dispensed_by_id` | string | FK, optional | Who handed out the medicine. |
| `dispensed_at` | datetime | optional | When. |
| `notes` | text | optional | Anything the prescriber wants pharmacy to know. |

## The prescriber is a member of staff, not a `Doctor` — and that is a change

The seed drew `Doctor ||--o{ Prescription : prescribes`. I have changed it to
`Staff`, and the reason is the controlled-drug rule.

`Doctor` is a one-to-one extension of `Staff` with **its own primary key**. So
`Doctor.id` and `Staff.id` are different id spaces, and
`dispensedById == prescribedById` — the whole content of the
segregation rule — would have been comparing two things that can never be equal.
The rule would have passed every time, silently, which is the worst way for a
safety rule to fail.

Holding the prescriber as `Staff` puts both sides of the comparison in one id
space. The *only a doctor may prescribe* constraint does not disappear; it moves
to where a who-may-do-this constraint belongs:

```
%%rbac role:doctor on Prescription.prescribe
```

That is the same arrangement as `Encounter.close`, and it is enforced on the
transition rather than implied by a foreign key.

## Three references to `Staff`, and only one drawn edge

`prescribed_by_id`, `verified_by_id` and `dispensed_by_id` all
point at `Staff`. The checker refuses a second `Staff ||--o{ Prescription` edge
(`EML124`, duplicate relationship) — a Mermaid ERD names a *pair*, not a column
— so exactly one can be drawn, and I drew the required one.

The other two resolve through the naming convention: `FK` plus an `_id` suffix
gives them a `Table Direct` control and a proper lookup in the Application
Dictionary. What they do **not** get is a database constraint, because the
migration emits one only for a declared one-to-many relationship. This is the
same accepted trade as `Department.head_doctor_id` at entity 1 — named here so
it is a decision on the record rather than an oversight.

## 2 · Enums

```
%%enum PrescriptionStatus: draft, prescribed, verified, dispensed, collected, cancelled
```

## 3 · Relationships

| Direction | Other entity | Cardinality | FK lives on |
|---|---|---|---|
| in | `Encounter` | many-to-one | `Prescription.encounter_id` |
| in | `Staff` | many-to-one | `Prescription.prescribed_by_id` |
| out | `PrescriptionItem` | one-to-many | `PrescriptionItem.prescription_id` |

`Patient ||--o{ Prescription` is removed from the seed, for the third time and
the same reason: `Prescription → Encounter → Patient` already resolves, and a
pharmacist can read `Encounter`.

## 4 · Lifecycle — `PrescriptionLifecycle`

```
[*] --> draft
draft      --> prescribed : prescribe   (doctor)
prescribed --> verified   : verify      (pharmacist)
verified   --> dispensed  : dispense    (pharmacist)
dispensed  --> collected  : collect     (nurse | pharmacist)
```
plus `cancel` out of `draft`, `prescribed` and `verified`.

**This is the longest chain in the model, and every link is a different person's
job.** The topology alone forbids dispensing something no pharmacist verified:
there is no edge from `prescribed` to `dispensed`, so that write is refused with
a 403 for every caller, the administrator included. The `%%rbac` lines on top
answer the second question — *who* may cross each edge — and that one the master
role does bypass.

Cancellation stops at `verified`. Once the medicine has been handed out, the
record of that is not cancelled.

## 5 · Rules — `controlledDrugSegregation`

```
%%action refuseSelfDispense validation-error
  when: status == 'dispensed' and hasControlledItem == true
        and dispensedById == prescribedById
```

§7 of the research: *the person who prescribes is not the person who dispenses*,
for controlled drugs. It **refuses** — a rule that merely flagged this would be a
note in a log nobody reads, and the requirement is a control, not an
observation.

It is scoped to controlled drugs because that is what the research states. On an
ordinary medicine, a single-handed hospital at night has to be able to dispense
what it prescribed.

## 6 · Hooks

```
%%hook beforeCreate stampPrescriptionNumber on Prescription
```

## 7 · Cross-entity effects — one, deferred on purpose

§2 of the research has the pharmacist finishing *"a prescription turned into
dispensed medicine, with the stock decremented"*. That decrement is a saga onto
`StockTransaction`, which does not exist yet. **Recorded here, built at Phase 5**
when the stock group is in — building it now would mean writing a step against
an entity with one column.

## 8 · Access

| Operation | Roles |
|---|---|
| read | `doctor`, `nurse`, `pharmacist`, `administrator` |
| create | `doctor` |
| update | `doctor`, `pharmacist`, `nurse` |
| delete | `administrator` |

No `billing_clerk`. A dispensed medicine is billable, but what is billed is a
charge on an invoice — priced from `ChargeableItem` — not the prescription
itself. Billing does not need to read what a patient was put on.

## Open questions

None. The stock decrement is scheduled, not open.

---

## Phase 6 repair — `has_controlled_item`, and why the column exists

`refuseSelfDispense` read `hasControlledItem`, which is a fact about the
prescription's *items* and their medicines — three rows away. Phase 6 established
that a rule sees only the row being written.

Rather than lose the model's most important control, the fact is now a column:
**`has_controlled_item boolean`**, written by
`%%hook afterCreate flagControlledPrescription on PrescriptionItem` when an item
is added. The rule then reads it, `dispensedById` and `prescribedById` — all
three columns of the prescription — and fires.

The column earns its place independently: pharmacy's worklist flags a controlled
prescription, and that flag is this.
