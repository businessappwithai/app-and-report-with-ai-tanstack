# Encounter — dossier

Phase 4, entity 10 of 30. **The spine of the clinical record.** Notes,
observations, diagnoses, procedures, every order and the invoice all hang off
one. §6 of the research: an encounter is one clinical contact, not the patient's
whole day.

## 1 · Fields

| Column | Type | Modifiers | Help |
|---|---|---|---|
| `id` | string | PK | — |
| `encounter_number` | string | UK, required | The reference this contact is known by across the record. |
| `patient_id` | string | FK, required | Who was seen. |
| `doctor_id` | string | FK, required | The clinician who led the contact and is accountable for it. |
| `department_id` | string | FK, required | The department that managed it. |
| `appointment_id` | string | FK, optional | The appointment this came from. Empty for an unbooked contact — a ward review or a walk-in. |
| `encounter_type` | string | required, enum | Which setting the contact happened in. |
| `status` | string | required, enum | Where it has got to. Closing it is what makes it billable. |
| `started_at` | datetime | required | When the clinician began. |
| `ended_at` | datetime | optional | When they finished. Empty while it is open. |
| `chief_complaint` | text | optional | What the patient came in about, in their words. |
| `is_billable` | boolean | required | Whether this contact generates an invoice. A ward review inside an admission usually does not. |

## 2 · Enums

```
%%enum EncounterType: outpatient, inpatient, emergency, telemedicine
%%enum EncounterStatus: open, in_progress, closed, cancelled
```

## 3 · Relationships

The most connected entity in the model. In: `Patient`, `Doctor`, `Department`,
`Appointment`. Out: `ClinicalNote`, `VitalSign`, `Diagnosis`, `Procedure` (all
children), plus `Admission`, `Prescription`, `LabOrder`, `ImagingOrder`,
`Invoice`.

## 4 · Lifecycle — `EncounterLifecycle`

```
[*] --> open
open --> in_progress : begin
open --> cancelled   : cancel
in_progress --> closed : close
closed --> [*]
cancelled --> [*]
```

Deliberately short. **There is no edge out of `closed`.** A closed encounter is
the clinical and legal record of what happened; correcting it is an addendum —
a new note — not an edit of the contact. That is a real hospital rule and the
guard enforces it for everyone, the administrator included.

## 5 · Rules

**`encounterCloseGate`** on `beforeUpdate`, and it must **act**: refuse the
close if the encounter carries no diagnosis. An encounter closed with nothing
recorded is a contact that cannot be coded, cannot be billed and cannot be
audited.

## 6 · Hooks

```
%%hook beforeCreate stampEncounterNumber on Encounter
%%hook afterUpdate recordEncounterDuration on Encounter
```

## 7 · Cross-entity effects

Closing a billable encounter raises an `Invoice`. Saga at Phase 5.

## 8 · Access

read: every clinical and administrative role except `inventory_manager` —
the lab, radiology and pharmacy all resolve an encounter on their worklists ·
create/update: `doctor`, `nurse`, `hospital_manager`, `administrator` ·
`close`: `doctor` only — closing is a clinical sign-off, not an administrative one

## Open questions

None.

---

## Phase 6 repair — `encounterCloseGate` became a handler

The rule refused closing an encounter with no diagnosis, reading
`diagnosisCount` — a count of child rows, which the rules engine is not given.
The whole rule is gone and the check is
`%%hook beforeUpdate requireDiagnosisToClose on Encounter`.

`raiseInvoice` is unaffected: `status` and `isBillable` are both columns of the
encounter.
