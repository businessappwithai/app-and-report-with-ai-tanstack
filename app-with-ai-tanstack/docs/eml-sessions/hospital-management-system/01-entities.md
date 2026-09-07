# Hospital Management System — entity roster

Phase 2 (`llmdetailed.txt` §10.2). Derived from the approved `00-research.md`,
not from the existing published model — that is used only as a cross-check at
the end of this document.

Scope from Gate A: **core only**, **insurance-based billing**, **one admission
per stay**, **consent as a record**.

---

## The roster

Read roles are a first draft of the `%%rbac … read` matrix; Gate D settles them.

### Organisation and people

| Name | Role — what it is, and when a record appears | Source | Placement | Category | Read roles |
|---|---|---|---|---|---|
| `Department` | An organisational unit — Cardiology, Radiology, Pathology. Created when the hospital is set up; rarely changes. | §6 vocabulary: department ≠ ward | standalone | Organisation | all clinical + admin |
| `Ward` | A physical place holding beds, run by a department. | §6 | standalone | Organisation | clinical + ward mgmt |
| `Bed` | One trackable bed in a ward, with a type and an occupancy state. Exists from the day the ward opens. | §2 — bed management is a named job, so the thing it manages is an entity | standalone | Organisation | clinical + ward mgmt |
| `Staff` | Anyone who works here and signs in. Created on hire, deactivated on leaving — never deleted, because their finished work must still resolve. | §2 actors | standalone | Organisation | all |

### The patient and the clinical record

| Name | Role | Source | Placement | Category | Read roles |
|---|---|---|---|---|---|
| `Patient` | The master patient record. Created at first contact, kept for decades. | §1, §7 retention | standalone | Patients | clinical + billing + reception |
| `InsurancePolicy` | The cover a patient carries: insurer, policy number, validity dates, co-pay rule. | Gate A fork 1 | standalone | Billing | billing + reception |
| `Appointment` | A booked future slot. Created when reception books it. | §3 | standalone | Scheduling | clinical + reception |
| `Encounter` | **The clinical spine.** One contact between a patient and a clinician — what an appointment becomes when the patient actually arrives, and what an admission generates daily. | §3, §4 | standalone | Clinical | clinical |
| `Admission` | An inpatient stay: from taking a bed to giving it back. Carries the bed, which changes on transfer. | §4, Gate A fork 2 | standalone | Clinical | clinical + ward mgmt |
| `ClinicalNote` | One written note within an encounter. | §3 | **child of `Encounter`** | — | clinical |
| `VitalSign` | One set of observations taken at one time. | §3 | **child of `Encounter`** | — | clinical |
| `Diagnosis` | A conclusion recorded against an encounter. | §3 | **child of `Encounter`** | — | clinical |
| `Procedure` | Something done to the patient during an encounter, and the thing consent attaches to. | §3, Gate A fork 4 | **child of `Encounter`** | — | clinical |
| `Consent` | A patient's consent to one procedure: who consented, when, who witnessed. | Gate A fork 4 | standalone | Clinical | clinical |

### Orders and what comes back

| Name | Role | Source | Placement | Category | Read roles |
|---|---|---|---|---|---|
| `LabOrder` | A request for a test, with the clinician who is responsible for it. | §3, §6 "order" | standalone | Diagnostics | clinical + lab |
| `LabResult` | One measured value against a lab order, with its reference range. | §3 | **child of `LabOrder`** | — | clinical + lab |
| `ImagingOrder` | A request for an image. | §3 | standalone | Diagnostics | clinical + radiology |
| `ImagingReport` | The radiologist's prose against an imaging order. **Not** the same shape as a lab result. | §6 — result ≠ report | **child of `ImagingOrder`** | — | clinical + radiology |

### Pharmacy

| Name | Role | Source | Placement | Category | Read roles |
|---|---|---|---|---|---|
| `Medication` | The drug catalogue: name, form, strength, controlled flag. A **lookup entity** — the flow depends on it silently. | §5 drug-clash rule needs something to clash | standalone | Pharmacy | clinical + pharmacy |
| `Prescription` | What was prescribed at one encounter, by one prescriber. | §3 | standalone | Pharmacy | clinical + pharmacy |
| `PrescriptionItem` | One drug on a prescription, with dose and duration. | §3, §6 "item" | **child of `Prescription`** | — | clinical + pharmacy |

### Money

| Name | Role | Source | Placement | Category | Read roles |
|---|---|---|---|---|---|
| `ChargeableItem` | The **price list**: what a consultation, a bed-night, a test, an image or a drug costs. See "the entity the brief did not mention" below. | §1 — "things that have prices" | standalone | Billing | billing + admin |
| `Invoice` | The episode priced. Created when an encounter or admission closes. | §3 | standalone | Billing | billing + admin |
| `InvoiceLine` | One charge on an invoice. | §3, §6 "line" | **child of `Invoice`** | — | billing + admin |
| `Payment` | Money received against an invoice, from the insurer or the patient. | §3 | standalone | Billing | billing + admin |

### Stock

| Name | Role | Source | Placement | Category | Read roles |
|---|---|---|---|---|---|
| `Supplier` | Who consumables are bought from. Lookup entity. | §3 | standalone | Stock | stores + admin |
| `InventoryItem` | A stocked consumable, with a quantity on hand and a reorder level. | §2 stores actor, §5 reorder rule | standalone | Stock | stores + clinical |
| `StockTransaction` | One movement that changes a quantity: receipt, issue, correction, return. The count is the sum of these, never typed in. | §3 | standalone | Stock | stores + admin |

**26 entities**, of which **7 are children**.

---

## The parent/child argument

§10.2 requires the three questions answered in writing for every entity. They
are only *interesting* for the seven children and the three near-misses, so
those are argued; the rest are standalone because a list of them is plainly
useful on its own (a list of patients, of wards, of invoices).

| Entity | 1. Useful list away from its owner? | 2. Identity depends on owner? | 3. Owner deleted ⇒ meaningless? | Verdict |
|---|---|---|---|---|
| `ClinicalNote` | No — a note out of its encounter is unreadable | Yes | Yes | **child** |
| `VitalSign` | No | Yes | Yes | **child** |
| `Diagnosis` | Arguably — an epidemiologist wants all diagnoses | Yes | Yes | **child** — the reporting use is a query, not a screen |
| `Procedure` | Arguably — a theatre list is all procedures | Yes | Yes | **child** — and if theatre scheduling ever comes into scope (§8) this is the one to revisit |
| `LabResult` | No — a value without its order has no reference range or patient | Yes | Yes | **child** |
| `ImagingReport` | No | Yes | Yes | **child** |
| `PrescriptionItem` | No | Yes — "item 2 of prescription 7" | Yes | **child** |
| `InvoiceLine` | No | Yes | Yes | **child** |

Near-misses, argued because getting them wrong is what puts a screen nobody
opens on the dashboard:

- **`Bed` is standalone, not a child of `Ward`.** Question 1 answers *yes*
  loudly: "show me every free bed" is the bed manager's whole job, and that list
  crosses wards. Beds also outlive ward reorganisations.
- **`Consent` is standalone, not a child of `Procedure`.** Question 1: yes — "show
  me every consent recorded today" is an audit screen someone really opens, and
  it is the reason consent was made a record rather than a flag at Gate A.
- **`Admission` is standalone, not a child of `Patient`.** Question 1: yes —
  the ward round is a list of admissions.

---

## The entity the brief did not mention

§10.2 warns that the reference and lookup entities are where a single-pass model
loses things. One is missing from the published model and I believe it is a real
gap rather than a difference of opinion:

**`ChargeableItem` — the price list.** §1 of the research says the business
model is "things are done to them that have prices". Without a price list,
`InvoiceLine` has to carry a free-typed description and an amount somebody keyed
in, which means: no two invoices price the same procedure the same way, no
report can total revenue by service, and the co-pay rule has nothing to compute
against. Every real hospital system has this table.

**This is the roster's most consequential addition and it is a Gate B question,
not my decision.**

---

## Relationship sketch

Enough for the Phase 3 skeleton to be drawn. Foreign key lives on the *many*
side in every case.

```
Department ||--o{ Ward              a department runs wards
Ward       ||--o{ Bed               a ward holds beds
Department ||--o{ Staff             staff belong to a department

Patient    ||--o{ InsurancePolicy   a patient may hold policies over time
Patient    ||--o{ Appointment       booked slots
Patient    ||--o{ Encounter         clinical contacts
Patient    ||--o{ Admission         inpatient stays
Staff      ||--o{ Appointment       the clinician the slot is with
Staff      ||--o{ Encounter         the clinician seen
Ward       ||--o{ Admission         where the stay is
Bed        ||--o{ Admission         which bed (changes on transfer)

Encounter  ||--o{ ClinicalNote      child
Encounter  ||--o{ VitalSign         child
Encounter  ||--o{ Diagnosis         child
Encounter  ||--o{ Procedure         child
Procedure  ||--o{ Consent           consent is to a procedure
Encounter  ||--o{ LabOrder          ordered during
Encounter  ||--o{ ImagingOrder      ordered during
Encounter  ||--o{ Prescription      prescribed during
LabOrder   ||--o{ LabResult         child
ImagingOrder ||--o{ ImagingReport   child
Medication ||--o{ PrescriptionItem  which drug
Prescription ||--o{ PrescriptionItem child

Patient    ||--o{ Invoice           who is billed
Encounter  ||--o{ Invoice           what is billed
InsurancePolicy ||--o{ Invoice      what pays
Invoice    ||--o{ InvoiceLine       child
ChargeableItem ||--o{ InvoiceLine   what was charged for
Invoice    ||--o{ Payment           settlement

Supplier      ||--o{ InventoryItem     who supplies it
InventoryItem ||--o{ StockTransaction  what moved
Staff         ||--o{ StockTransaction  who moved it
```

---

## Cross-check against the published model

The model this replaces has **28 entities**. Mine has **26**. The differences,
all deliberate:

| Published has | Mine | Why |
|---|---|---|
| `Doctor`, `Nurse` as separate entities | one `Staff` with a role | **Gate B question** — see below |
| — | `Consent` | Added at Gate A |
| — | `ChargeableItem` | The price list argued above |
| `Medication` | same | — |
| everything else | same | The rosters otherwise agree entity for entity, which is a reasonable sign both derivations are sound |

---

## Gate B — what I need decided

1. **`Staff` with a role, or separate `Doctor` and `Nurse`?** The published
   model separates them. Separate entities let a doctor carry a specialty and a
   licence number while a nurse carries a grade and a home ward — real
   differences. One `Staff` entity avoids three tables for one concept and makes
   "who saw this patient" a single foreign key instead of two nullable ones.
2. **Is `ChargeableItem` in?** Argued above. Without it, invoice lines are typed
   by hand.
3. **What does this hospital have that is not on this list?** The question §10.2
   says lands hardest — this is the cheapest moment in the whole protocol to add,
   merge, split or rename anything.
