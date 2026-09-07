# Admission — dossier

Phase 4, entity 11 of 30. One inpatient stay. Per Gate A, a ward transfer moves
the bed on this record rather than starting a new one — one stay is always one
admission.

## 1 · Fields

| Column | Type | Modifiers | Help |
|---|---|---|---|
| `id` | string | PK | — |
| `admission_number` | string | UK, required | The reference the stay is known by. |
| `patient_id` | string | FK, required | Who was admitted. |
| `encounter_id` | string | FK, required | The contact that led to the admission. |
| `ward_id` | string | FK, required | The ward the patient is on now. Changes on transfer. |
| `bed_id` | string | FK, required | The bed they are in now. Changes on transfer. |
| `admission_type` | string | required, enum | How they came in, which drives priority and reporting. |
| `status` | string | required, enum | Where the stay has got to. |
| `admitted_at` | datetime | required | When the bed was taken. |
| `expected_discharge_date` | date | optional | The working estimate, used for bed planning. |
| `discharged_at` | datetime | optional | When the bed was given back. Empty until discharge. |
| `discharge_summary` | text | optional | What happened and what happens next. Required before discharge — see the rule. |

## 2 · Enums

```
%%enum AdmissionType: elective, emergency, transfer_in, day_case
%%enum AdmissionStatus: admitted, on_ward, discharge_planned, discharged, cancelled
```

## 3 · Relationships

In: `Patient`, `Encounter`, `Ward`, `Bed`.

## 4 · Lifecycle — `AdmissionLifecycle`

```
[*] --> admitted
admitted --> on_ward            : settle
admitted --> cancelled          : cancel
on_ward --> discharge_planned   : plan_discharge
on_ward --> discharged          : discharge
discharge_planned --> discharged : discharge
discharge_planned --> on_ward    : defer_discharge
discharged --> [*]
cancelled --> [*]
```

`defer_discharge` exists because a planned discharge that does not happen is the
normal case, not an exception — the transport does not arrive, the bloods come
back wrong. Without that edge the ward has to either lie or be stuck.

`cancel` is reachable only from `admitted`: once a patient is settled on a ward,
the stay happened, and ending it is a discharge.

## 5 · Rules

Two, both of which must **act** — these are the two the research named first.

**`bedAvailabilityGate`** on `beforeCreate`: refuse the admission if the chosen
bed is not `available`, or if its `bed_type` does not suit the admission. This
is the rule that stops two patients being put in one bed.

**`dischargeSummaryGate`** on `beforeUpdate`: refuse the move to `discharged`
when `discharge_summary` is empty. A discharge without a summary is a patient
sent home with nothing for their GP.

## 6 · Hooks

```
%%hook beforeCreate stampAdmissionNumber on Admission
%%hook afterUpdate recordLengthOfStay on Admission
```

## 7 · Cross-entity effects

Two, both on `Bed`, both built as a saga at Phase 5 and checked at Gate D:

- admitting moves the chosen bed to `occupied`;
- discharging moves it to `cleaning` — never straight to `available`, which the
  bed's own state machine already forbids.

## 8 · Access

read: `doctor`, `nurse`, `ward_manager`, `billing_clerk`, `hospital_manager`,
`administrator` — not reception, pharmacy, the lab or radiology, none of whom
manage inpatients · create/update: `doctor`, `nurse`, `ward_manager`,
`hospital_manager`, `administrator` · `discharge`: `doctor`, `ward_manager` ·
`cancel`: `doctor`, `hospital_manager`

## Open questions

None.

---

## Phase 6 repair — `bedAvailabilityGate` became a handler

Both actions read the referenced bed — `bedStatus` and `bedTypeSuitable` — so
neither could fire. The rule is gone and the check is
`%%hook beforeCreate checkBedAvailable on Admission`.

`requireDischargeSummary` and `releaseBed` are unaffected: `status` and
`dischargeSummary` are columns of the admission.
