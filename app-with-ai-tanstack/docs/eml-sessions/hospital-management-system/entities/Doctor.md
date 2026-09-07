# Doctor — dossier

Phase 4, entity 5 of 30. Walked with `Nurse`, because the argument for one is
the argument for the other.

## What this entity is for

A one-to-one **extension** of `Staff`, not a second kind of person. `Staff`
holds what everyone who signs in has; this holds what only a doctor has — and
what only a doctor may be the subject of: leading an encounter, performing a
procedure, prescribing, and interpreting an image.

The relationship is `Staff |o--o| Doctor`, optional on both sides. Optional on
the `Staff` side because most staff are not doctors; optional on the `Doctor`
side is an artefact of the notation rather than an intention — a doctor row
without a staff row would be a clinician who cannot sign in, and Phase 5 should
check none exists.

## 1 · Fields

| Column | Type | Modifiers | Help text |
|---|---|---|---|
| `id` | string | PK | — |
| `staff_id` | string | FK, UK, required | The staff record this doctor is. Unique, because one person is one doctor. |
| `registration_number` | string | UK, required | The number on the professional register they are licensed under. Unique, and the thing an audit checks. |
| `specialty` | string | required, enum | The field they practise in. Decides which encounters and referrals reach them. |
| `qualification` | string | optional | Their qualifications as they should appear on a letter — MBBS, FRCP. |
| `is_consultant` | boolean | required | Whether they hold consultant responsibility. A consultant may sign off work a junior cannot. |
| `accepts_new_patients` | boolean | required | Untick to keep them off the booking screen without deactivating the staff record. |

**No fee column.** A doctor's charge for a consultation is a price, and prices
live in `ChargeableItem` — the entity added at Gate B for exactly this reason.
Putting one here would give the model two places to answer "what does this
cost", which is how two invoices for the same consultation come to disagree.

## 2 · Enums

```
%%enum DoctorSpecialty: general_medicine, cardiology, surgery, paediatrics,
                        obstetrics, radiology, pathology, anaesthetics,
                        psychiatry, geriatrics
```

Ten specialties, chosen to cover the departments the research names and no more.
A real hospital has sub-specialties; this is the level at which a booking screen
filters, which is the job the enum has to do.

## 3 · Relationships

| Direction | Other entity | Cardinality | FK lives on |
|---|---|---|---|
| in | `Staff` | one-to-one | `Doctor.staff_id` |
| out | `Appointment` | one-to-many | `Appointment.doctor_id` |
| out | `Encounter` | one-to-many | `Encounter.doctor_id` |
| out | `Procedure` | one-to-many | `Procedure.doctor_id` |
| out | `Prescription` | one-to-many | `Prescription.doctor_id` |
| out | `ImagingReport` | one-to-many | `ImagingReport.doctor_id` |
| in | `Department` | the head, via `Department.head_doctor_id` | not drawn — see Department's dossier |

## 4 · Lifecycle · 5 · Rules · 6 · Hooks

**None of the three.** Whether a doctor is practising is `Staff.is_active`;
whether they are taking bookings is `accepts_new_patients`. Neither is a process
with steps.

## 7 · Cross-entity effects

None. The prescribing restriction — that a prescriber is not a dispenser —
lands on `Prescription`, where the write happens.

## 8 · Access

| Operation | Roles |
|---|---|
| read | everyone, as with `Staff` — every clinical screen resolves a doctor |
| create / update / delete | `hospital_manager`, `administrator` |

## Open questions

None.
