# LabOrder — dossier

Phase 4, entity 17 of 30. **Standalone**, Diagnostics. The first of the four
entities that carry work *out* of an encounter and bring an answer back.

## Why standalone rather than a child of `Encounter`

§10.2 question 1: "show me every request the laboratory owes us a result on" is
a screen a lab technician lives in all day, and it crosses encounters, patients
and wards. A child renders inside its parent and cannot be that screen.

## 1 · Fields

| Column | Type | Modifiers | Help |
|---|---|---|---|
| `id` | string | PK | — |
| `order_number` | string | UK, required | The laboratory's own number, printed on every specimen label. Generated, never typed. |
| `encounter_id` | string | FK, required | The contact the test was requested during. |
| `ordered_by_id` | string | FK, required | Who is responsible for it — and who a critical result is escalated to. |
| `test_code` | string | required | The laboratory's code. |
| `test_name` | string | required | The test in words. |
| `specimen_type` | string | required, enum | What has to be collected. Decides the container. |
| `priority` | string | required, enum | How fast it must be turned round. |
| `status` | string | required, enum | Where the request has got to. Driven by the lifecycle. |
| `is_escalated` | boolean | required | Set by the escalation saga, not by hand. |
| `ordered_at` | datetime | required | When it was raised. |
| `collected_at` | datetime | optional | When the specimen was actually taken. |
| `clinical_details` | text | optional | Why it was requested. The laboratory needs it to interpret the value rather than merely report it. |

## 2 · Enums

```
%%enum SpecimenType: blood, urine, stool, sputum, swab, tissue, csf
%%enum OrderPriority: routine, urgent, stat
%%enum LabOrderStatus: requested, collected, in_lab, resulted, cancelled
```

`OrderPriority` is **shared with `ImagingOrder`** on purpose. A ward that says
"stat" means the same thing to both departments, and two enums would let the
two worklists sort differently for the same word.

## 3 · Relationships

| Direction | Other entity | Cardinality | FK lives on |
|---|---|---|---|
| in | `Encounter` | many-to-one | `LabOrder.encounter_id` |
| in | `Staff` | many-to-one | `LabOrder.ordered_by_id` |
| out | `LabResult` | one-to-many | `LabResult.lab_order_id` |

**I removed `Patient ||--o{ LabOrder` from the seed.** It was a second path to
the patient — `LabOrder → Encounter → Patient` already resolves — and this is
the same objection I made against a direct `patient_id` on `Consent`. Two paths
can disagree; a lab order attached to encounter A but patient B is a wrong that
nothing would catch. I checked the one thing that would have justified keeping
it: whether a lab technician can read `Encounter` and so follow the path. They
can — `lab_technician` is on `Encounter.read`.

## 4 · Lifecycle — `LabOrderLifecycle`

```
[*] --> requested
requested --> collected : collect
requested --> cancelled : cancel
collected --> in_lab   : receive
collected --> cancelled : cancel
in_lab    --> resulted : result
```

**There is no edge from `requested` to `resulted`.** A result that appears
against a specimen nobody collected is either a mix-up or a fabrication, and the
generated API refuses that write with a 403 for every caller, administrator
included. That is the topological half; who may cross each edge is the separate
question, answered here as: nurses and doctors collect, the laboratory receives
and results.

Cancellation is available up to the point the laboratory has the specimen, and
not after. Once it is `in_lab` the work has been done and the result is owed.

## 5 · Rules

None on this entity — the judgements are about the value, so they live on
`LabResult`.

## 6 · Hooks

```
%%hook beforeCreate stampLabOrderNumber on LabOrder
```

Same reasoning as the MRN: a hand-keyed order number is how two specimens come
to share a label.

## 7 · Cross-entity effects

Inbound, from `LabResult`: the escalation saga writes `is_escalated` and raises
`priority` to `stat` on this record. Both columns exist for that saga to write
and neither is offered to a user.

## 8 · Access

| Operation | Roles |
|---|---|
| read | `doctor`, `nurse`, `lab_technician`, `billing_clerk`, `hospital_manager`, `administrator` |
| create | `doctor`, `nurse` |
| update | `doctor`, `nurse`, `lab_technician` |
| delete | `administrator` |

**`billing_clerk` reads the order and not the result.** A test is a billable
item, so billing has to know it was done; what it came back as is clinical. It
is the same line drawn between `Diagnosis` (billing reads it — it is the coding)
and `ClinicalNote` (it does not).

## Open questions

None.
