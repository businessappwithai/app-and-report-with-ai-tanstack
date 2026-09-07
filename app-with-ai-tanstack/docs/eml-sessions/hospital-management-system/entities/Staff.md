# Staff — dossier

Phase 4, entity 4 of 30. The people, after the places. Walked before `Doctor`
and `Nurse` because both extend it one-to-one.

## 1 · Fields

| Column | Type | Modifiers | Help text |
|---|---|---|---|
| `id` | string | PK | — |
| `staff_number` | string | UK, required | The payroll and badge number. Unique, and the identifier used on anything printed. |
| `first_name` | string | required | Given name, as it should appear on screen and on a signed note. |
| `last_name` | string | required | Family name. |
| `work_email` | email, UK | required | Where work reaches them, and the address they sign in with. |
| `phone` | phone | optional | Contact number — a bleep or a mobile. |
| `department_id` | string | FK, required | The department that employs them. |
| `staff_role` | string | required, enum | What this person does, which decides what the application lets them see and do. |
| `job_title` | string | optional | The title on their contract, which is finer-grained than the role — "Senior Staff Nurse" against a role of `nurse`. |
| `hired_on` | date | required | When they joined. |
| `is_active` | boolean | required | Untick when someone leaves rather than deleting them — every note, order and result they signed must still resolve to a person, for years. |

**The display value resolves to `first_name` + `last_name`.** No `name` column
exists, so the dictionary's identifier rule falls to the forename/surname pair,
which is what a reference to a staff member should show — "Priya Anand", not a
uuid. Worth stating because it is derived rather than declared, and adding a
`name` column later would silently change every lookup in the application.

## 2 · Enums

```
%%enum StaffRole: receptionist, doctor, nurse, lab_technician, radiologist,
                  pharmacist, ward_manager, billing_clerk, inventory_manager,
                  hospital_manager
```

Ten values, one per actor in `00-research.md` §2. **This list and the `%%rbac`
role vocabulary must stay the same words** — a `staff_role` of `lab_technician`
and an access rule naming `role:lab_technician` are how a seeded account gets
the screens its holder needs. Where they drift, someone signs in and sees
nothing, with no diagnostic to explain it. Phase 5 checks the two against each
other.

## 3 · Relationships

| Direction | Other entity | Cardinality | FK lives on |
|---|---|---|---|
| in | `Department` | many-to-one | `Staff.department_id` |
| out | `Doctor` | one-to-one, optional both ways | `Doctor.staff_id` |
| out | `Nurse` | one-to-one, optional both ways | `Nurse.staff_id` |
| out | `ClinicalNote` | one-to-many | `ClinicalNote.staff_id` |
| out | `VitalSign` | one-to-many | `VitalSign.staff_id` |
| out | `Diagnosis` | one-to-many | `Diagnosis.staff_id` |
| out | `LabOrder` | one-to-many | `LabOrder.staff_id` |
| out | `LabResult` | one-to-many | `LabResult.verified_by` |
| out | `ImagingOrder` | one-to-many | `ImagingOrder.staff_id` |
| out | `StockTransaction` | one-to-many | `StockTransaction.staff_id` |

Ten outgoing relationships makes `Staff` the second most-referenced entity in
the model after `Encounter`, which is right: almost everything clinical records
who did it.

## 4 · Lifecycle

**None.** Joining, changing job and leaving are a rostering concern, and §8 of
the research puts rostering explicitly out of scope. `is_active` and `hired_on`
carry what this model needs.

## 5 · Rules

**None.**

## 6 · Hooks

One, and it earns its place:

```
%%hook beforeUpdate preventRoleEscalation on Staff
```

Changing a person's `staff_role` changes what they can see across the whole
application. That is the single most consequential write in this entity and it
should not be an ordinary field edit — the handler is where a hospital would put
"only a hospital manager may do this, and it is written to the audit trail".

## 7 · Cross-entity effects

Deactivating a member of staff must not cascade. Their notes, orders and
verified results stay attributed to them — that is the whole reason the row is
kept.

## 8 · Access

| Operation | Roles |
|---|---|
| read | everyone — the staff directory is reference data |
| create / update / delete | `hospital_manager`, `administrator` |

Read is open for the same reason as `Department`: every screen that shows "who
recorded this" has to resolve a staff row, and a lookup that 403s renders as a
blank field. What is *in* the row is deliberately thin — no home address, no pay,
no next of kin — so an open read costs nothing sensitive.

## Open questions

None.
