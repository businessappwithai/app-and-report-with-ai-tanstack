# Department — dossier

Phase 4, entity 1 of 30. Walked first because everything organisational hangs
off it: wards, staff, appointments and encounters all name one.

## 1 · Fields

| Column | Type | Modifiers | Help text (becomes `sys_column.description`) |
|---|---|---|---|
| `id` | string | PK | — |
| `name` | string | UK, required | The department's name as the hospital uses it — Cardiology, Radiology, Pathology. Unique, because two departments with one name is how a patient is sent to the wrong place. |
| `code` | string | UK, required | The short code that appears on forms and reports, e.g. CARD. |
| `department_type` | string | required, enum | What kind of unit this is. Decides whether it holds wards and beds, or only sees outpatients. |
| `doctor_id` | string | FK, optional | The consultant who runs the department. Optional because a department can be between heads. |
| `phone_extension` | string | optional | The internal number the switchboard puts calls through on. |
| `floor` | string | optional | Which floor of the building to find it on. |
| `is_active` | boolean | required | Untick when a department closes, rather than deleting it — the encounters it managed must still resolve. |

## 2 · Enums

```
%%enum DepartmentType: clinical, diagnostic, surgical, support, administrative
```

- **clinical** — sees and admits patients (Cardiology, Paediatrics)
- **diagnostic** — produces results and reports (Pathology, Radiology)
- **surgical** — theatres and their teams
- **support** — pharmacy, stores, catering
- **administrative** — billing, records, management

## 3 · Relationships

| Direction | Other entity | Cardinality | FK lives on |
|---|---|---|---|
| out | `Ward` | one-to-many | `Ward.department_id` |
| out | `Staff` | one-to-many | `Staff.department_id` |
| out | `Appointment` | one-to-many | `Appointment.department_id` |
| out | `Encounter` | one-to-many | `Encounter.department_id` |
| in | `Doctor` | the head, via `doctor_id` | `Department.doctor_id` |

**It is named `doctor_id` and not `head_doctor_id`, and that was a correction
made at Gate C-Billing.** The generator resolves a reference from the column name
alone: `head_doctor_id` resolves to a `HeadDoctor` table that does not exist, so
the column would have been stored as a plain string and rendered as a raw uuid.
`doctor_id` resolves to `bus_doctor`; the word *head* lives in the help text,
which is where the dictionary and the manual both read it from.

**`doctor_id` is a foreign key the ERD does not draw a line for.** That is
deliberate and it has a consequence worth stating: the generator emits a
database constraint only for a declared `oneToMany` relationship, so this column
is a reference the Application Dictionary will render as a lookup but the schema
will not enforce. Drawing a line for it as well would make `Department` and
`Doctor` mutually dependent, which is worse.

**`OPTIONAL` on that column is load-bearing, and the delivered `.mmd` was
missing it.** This table said optional and the help text said *"Left empty while
a department is between heads"*, but the entity block declared `string doctor_id
FK`. `Department`, `Doctor` and `Staff` already form a foreign-key cycle
(`doctor_id` → `Doctor`, `Doctor.staff_id` → `Staff`, `Staff.department_id` →
`Department`), and with all three mandatory no insert order satisfies them: the
browser seeder promotes one member and leaves its key null, which against a NOT
NULL column cost `Department` every sample row it had. `05-phase6-findings.md`
§4 has the account.

## 4 · Lifecycle

**None.** A department is open or closed, and `is_active` carries that. A state
machine here would be three states and no transitions anyone makes by hand.

## 5 · Rules

**None.** Nothing about creating or changing a department needs judgement.

## 6 · Hooks

**None at this entity.**

## 7 · Cross-entity effects

Deactivating a department does **not** cascade. Its wards, staff and past
encounters stay exactly as they are — this is a records system, and closing a
unit must not rewrite what happened while it was open.

## 8 · Access

| Operation | Roles |
|---|---|
| read | everyone — the department list is reference data every screen needs |
| create / update / delete | `hospital_manager`, `admin` |

Read is deliberately unrestricted: a receptionist booking an appointment, a
nurse looking at a ward and a billing clerk reading an invoice all need to
resolve a department name, and a lookup that 403s renders as a blank field.

## Open questions

None. Nothing here was a judgement call I could not make from the research.
