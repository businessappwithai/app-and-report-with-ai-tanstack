# Nurse — dossier

Phase 4, entity 6 of 30. Walked with `Doctor`.

## What this entity is for

The same arrangement as `Doctor`: a one-to-one extension of `Staff` holding what
only nursing staff have. The two exist separately rather than as one `Staff`
with nullable columns because a doctor's registration and specialty and a
nurse's grade and home ward are not the same facts wearing different names, and
a single table would render all four on every staff form.

## 1 · Fields

| Column | Type | Modifiers | Help text |
|---|---|---|---|
| `id` | string | PK | — |
| `staff_id` | string | FK, UK, required | The staff record this nurse is. Unique, because one person is one nurse. |
| `registration_number` | string | UK, required | The number on the nursing register they are licensed under. |
| `grade` | string | required, enum | Their nursing grade, which decides what they may do unsupervised and what needs countersigning. |
| `home_ward_id` | string | FK, optional | The ward they normally work on. Optional because bank and float staff have none. |
| `shift_pattern` | string | required, enum | Which shifts they normally work. Not a roster — the roster is out of scope — but it is what a ward manager filters on when looking for cover. |

## 2 · Enums

```
%%enum NurseGrade: student, staff_nurse, senior_staff_nurse, charge_nurse, matron
%%enum ShiftPattern: days, nights, rotating, bank
```

`NurseGrade` runs low to high on purpose: the order is the escalation path, and
a `student` may not sign off a bed as clean or administer a controlled drug
without a countersignature. `bank` in `ShiftPattern` is the value that pairs with
an empty `home_ward_id`.

## 3 · Relationships

| Direction | Other entity | Cardinality | FK lives on |
|---|---|---|---|
| in | `Staff` | one-to-one | `Nurse.staff_id` |
| in | `Ward` | many-to-one | `Nurse.home_ward_id` |

**`Ward ||--o{ Nurse : staffed_by` is a new relationship**, not in the published
model. It is drawn rather than left as an unlinked foreign key because "who
normally works this ward" is a question a ward manager asks, and a drawn edge is
what makes the schema enforce it and the dictionary render a proper lookup.

Nurses do not carry the clinical foreign keys doctors do. Observations, notes
and diagnoses all reference `Staff`, not `Nurse` — a nurse records a vital sign
*as a member of staff*, and so does a healthcare assistant. Attributing those to
`Nurse` would make them unrecordable by anyone else.

## 4 · Lifecycle · 5 · Rules · 6 · Hooks

**None of the three**, for the same reasons as `Doctor`.

## 7 · Cross-entity effects

None here. The grade-based countersigning rule is noted against `Bed.cleaned`
and `PrescriptionItem`, where the writes happen; Phase 5 checks both landed.

## 8 · Access

| Operation | Roles |
|---|---|
| read | everyone, as with `Staff` and `Doctor` |
| create / update / delete | `hospital_manager`, `ward_manager`, `administrator` |

`ward_manager` may maintain nurse records where they may not maintain doctors —
assigning a nurse's home ward is ward management, not HR.

## Open questions

None.
