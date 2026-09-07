# Hospital Management System — research

Phase 1 of the interactive authoring protocol (`llmdetailed.txt` §10.1, read from
appwithai.org). No entity is named here on purpose. This document is what Gate A
approves; the entity roster is derived from it in Phase 2.

**Tags.** `[stated]` the user said it · `[inferred]` follows from what was said ·
`[assumed]` a real guess that could plausibly be otherwise.

The brief was one line — *rebuild the complete hospital `.mmd`* — so almost
everything below is inferred or assumed. **The `[assumed]` lines are the agenda
for Gate A**, and the five marked **FORK** are the ones where two plausible
hospitals lead to materially different models.

---

## 1. What the business does, and who pays for it

A hospital treats patients and is paid for episodes of care. [inferred]

The transaction that makes money is the **billable episode**: a patient is seen,
things are done to them that have prices — a consultation, a bed-night, a test,
an image, a drug — and those become charges on an invoice that someone settles.
[inferred]

Who that someone is, is **FORK 1** and it is the largest single decision in this
model:

- an **insurer**, with the patient carrying a policy, a co-payment, and claims
  that can be rejected; or
- the **patient**, self-pay, at the point of discharge; or
- a **single public payer**, where billing is a cost-reporting exercise rather
  than a revenue one and there is no policy to check.

Each gives a different third of the roster. **[stated at Gate A — insurance-based]**:
patients carry a policy, the hospital bills the insurer, and the patient owes a
co-payment. Eligibility and co-pay are therefore real business rules, and
`InsurancePolicy` is a real entity.

## 2. The actors, and what each is trying to finish

Named by the thing they are trying to *complete*, not by job title, because that
is what decides their screens. [inferred throughout]

| Actor | Trying to finish |
|---|---|
| Receptionist / scheduler | Booking a patient into a slot, and checking them in when they arrive |
| Doctor | An encounter: seeing the patient, recording what they found, ordering what is needed, deciding what happens next |
| Nurse | A shift's care on a ward: observations recorded, medicines given, a bed made ready |
| Lab technician | A specimen turned into a result somebody can act on |
| Radiologist | An image turned into a report somebody can act on |
| Pharmacist | A prescription turned into dispensed medicine, with the stock decremented |
| Ward manager / bed manager | Every admitted patient in a bed, and a bed free when the next one needs it |
| Billing clerk | An episode turned into an invoice, and the invoice settled |
| Stores / inventory manager | Nothing clinical stopping because a consumable ran out |
| Hospital administrator | The whole thing, plus the accounts nobody else may touch |

**Segregation matters here more than in most businesses.** A billing clerk must
not read clinical notes; a receptionist must not read a diagnosis. That is not a
nicety, it is the point of the access model. [inferred]

## 3. The artefacts that change hands

In the hospital's own vocabulary, which is what the screens should say:

- **the appointment** — a booked future slot
- **the encounter** — one clinical contact, the thing an appointment becomes when
  the patient actually arrives
- **the admission** — an inpatient stay, from taking a bed to giving it back
- **the clinical note, the observation, the diagnosis, the procedure** — what was
  recorded, measured, concluded and done during an encounter
- **the order** — a request for something to be done elsewhere: a lab test, an
  image, a drug
- **the result / the report** — what comes back from that elsewhere
- **the prescription** and its **items** — what was prescribed, drug by drug
- **the invoice** and its **lines** — the episode priced
- **the payment** — the invoice settled, in whole or in part
- **the stock transaction** — the movement that keeps a consumable count honest

## 4. The lifecycle of the central artefact

The **encounter** is the spine of a hospital system: almost everything clinical
hangs off one. But the artefact with the most interesting lifecycle — the one
where the state machine earns its keep — is the **admission**. [inferred]

Draft lifecycles, in the business's words:

- **Appointment**: `requested → confirmed → checked_in → completed`, with
  `cancelled` and `no_show` as terminal exits. [inferred]
- **Encounter**: `open → in_progress → closed`, and closing it is what makes it
  billable. [inferred]
- **Admission**: `admitted → on_ward → discharge_planned → discharged`, with a
  bed released on discharge. [assumed — a real hospital also has transfers
  between wards, which may or may not be a state]
- **Lab order**: `ordered → collected → in_progress → resulted → verified`.
  [inferred — the verify step exists because an unverified result is not
  clinically actionable]
- **Prescription**: `prescribed → verified → dispensed → collected`. [assumed]
- **Invoice**: `draft → issued → part_paid → settled`, with `written_off` as the
  other terminal. [inferred]

**FORK 2 — is a ward transfer a state, or a new admission?** **[stated at Gate A
— one admission, the bed changes]**. A transfer moves the admission's bed and
leaves the admission itself intact, so one stay is one record and length-of-stay
stays a subtraction. There is no `Transfer` entity.

## 5. The decisions someone makes with judgement today

Each of these is a candidate `%%rule`, and each carries §3.4's question: does it
merely *decide*, or must it also *act*?

| Decision | Decides | Acts |
|---|---|---|
| Is there a bed of the right type free for this admission? | yes | yes — it takes the bed out of the pool |
| Is this patient's policy valid, and what is the co-pay? | yes | yes — it sets the amount the patient owes |
| Is this result outside the critical range? | yes | yes — a critical result must escalate, not just be flagged |
| Does this drug clash with something the patient is already on? | yes | yes — it must refuse the prescription |
| Has this consumable fallen to its reorder level? | yes | yes — it raises a replenishment |
| Is this invoice overdue? | yes | yes — it escalates to collections |
| Does this admission need a discharge summary before the bed is released? | yes | yes — it blocks the discharge |

The ones that must **act** are `%%action` directives, not decision graphs — this
is the distinction §3.4 says is expensive to get wrong. [inferred]

## 6. The vocabulary

Words that mean something specific here and must not be swapped for synonyms:

- **Encounter**, not "visit" — a visit is the patient's day, an encounter is one
  clinical contact within it.
- **Admission**, not "stay" — the admission is the record; the stay is its
  duration.
- **Order**, not "request" — an order is a clinical instruction with a
  responsible clinician attached.
- **Result** (lab, a value) vs **Report** (imaging, a radiologist's prose). They
  are different artefacts and should not be merged. [inferred]
- **Ward** (a place with beds) vs **Department** (an organisational unit like
  Cardiology). A department may run several wards. [inferred]
- **Bed** is a real trackable object, not a number on a ward. [inferred — bed
  management is a named job, so the thing it manages is an entity]
- **Item** on a prescription, **line** on an invoice — both children.

## 7. Policy and regulatory constraints

The ones that become `%%rbac`, required fields and audit flags. **FORK 3 — which
regime**, because it changes retention and consent:

- **Access is need-to-know, by role and by episode.** Clinical data is readable
  by clinicians; financial data by billing; neither by the other. [inferred]
- **Every read of a patient record is auditable.** [assumed — true under HIPAA
  and under GDPR-with-special-category data; the generated application's audit
  trail covers writes, so a read audit may be out of reach]
- **Retention is long** — years to decades, and longer for paediatric records.
  Records are not deleted; they are closed. [inferred]
- **Segregation of duties on controlled drugs**: the person who prescribes is
  not the person who dispenses. [inferred]
- **A result must be verified by a qualified person before it is clinically
  visible.** [inferred]
- **Consent** is recorded for procedures. **[stated at Gate A — a consent record
  per procedure]**: who consented, to what, when, and who witnessed it. This is
  an entity, and "was this procedure consented?" becomes a question a rule can
  refuse on.

## 8. What is explicitly out of scope

Naming these is what stops the roster growing by a third at Gate B. All
`[assumed]` — each is a plausible thing to include, and each would add entities:

- **Theatre and surgery scheduling** — operating lists, theatre slots, surgical
  teams. A system of its own.
- **Staff rostering and payroll** — who is on shift, leave, pay. Adjacent, not
  this.
- **Maternity, oncology and other specialty pathways** with their own protocols.
- **A full drug formulary with interaction data** — the interaction *rule* is in
  scope; the reference database behind it is not.
- **Medical device / equipment maintenance**.
- **Patient-facing portal** — booking and results for patients themselves.
- **Referrals in and out** to other providers. **[stated at Gate A — out of
  scope]**, though it was the more defensible of the two extensions and is the
  first thing to add if this model grows.
- **Emergency department triage** as a distinct flow. **[stated at Gate A — out
  of scope]**.

---

## Gate A — resolved

| Fork | Answer | What it changes |
|---|---|---|
| Who pays | **Insurer, with policies and co-pay** | `InsurancePolicy` is in; eligibility and co-pay are rules that *act* |
| Scope | **Core only** | No `Referral`, no ED arrival path or triage category |
| Ward transfer | **One admission, the bed changes** | No `Transfer` entity; the bed is a field on the admission |
| Consent | **A record per procedure** | `Consent` is an entity, and an unconsented procedure is refusable |

**Regulatory regime** was not put to the user as its own question, because its
modelling consequence reduces almost entirely to the consent decision above:
retention has no EML expression, and the generated application audits writes
whatever regime applies. Recorded here as an assumption rather than a fork:
access is need-to-know by role, records are closed rather than deleted, and the
prescriber is not the dispenser. [assumed]

Everything else in this document is either stated, or an inference I am
confident enough to carry into Phase 2 and correct at a later gate if wrong.
