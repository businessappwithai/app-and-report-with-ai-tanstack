# Bed — dossier

Phase 4, entity 3 of 30. The last of the places, before the people.

**This is the model's first state machine**, and the first entity where the
picture in the viewer will show something the ERD cannot.

## 1 · Fields

| Column | Type | Modifiers | Help text |
|---|---|---|---|
| `id` | string | PK | — |
| `bed_code` | string | UK, required | The hospital-wide identifier, ward code and number together — CCU-04. Unique across the hospital, because a bed board that shows two beds called 4 is a bed board nobody trusts. |
| `bed_number` | string | required | The number on the bed itself, unique only within its ward. |
| `ward_id` | string | FK, required | The ward this bed stands in. |
| `bed_type` | string | required, enum | What the bed is equipped for. An admission may only take a bed whose type suits it. |
| `status` | string | required, enum | Where the bed is in its cycle. Driven by the state machine below, not typed in. |
| `last_cleaned_at` | datetime | optional | When housekeeping last turned it round. Empty on a bed that has never been used. |
| `is_active` | boolean | required | Untick when a bed is decommissioned, rather than deleting it — past admissions must still resolve to the bed they were in. |

## 2 · Enums

```
%%enum BedType: standard, icu, hdu, cot, isolation, bariatric
%%enum BedStatus: available, occupied, cleaning, closed
```

`BedType` is deliberately **not** the same list as `WardType`. A ward is a place
with a purpose; a bed is equipment. A general ward can hold a bariatric bed, and
a paediatric ward holds cots — so binding beds to the ward's own vocabulary
would make those inexpressible.

## 3 · Relationships

| Direction | Other entity | Cardinality | FK lives on |
|---|---|---|---|
| in | `Ward` | many-to-one | `Bed.ward_id` |
| out | `Admission` | one-to-many | `Admission.bed_id` |

## 4 · Lifecycle — `BedOccupancy`

```
[*] --> available
available  --> occupied  : admit
occupied   --> cleaning  : discharge
cleaning   --> available : cleaned
available  --> closed    : close
cleaning   --> closed    : close
closed     --> available : reopen
closed     --> [*]
```

Four states and six moves, and every one of them is something a person does.

The point of drawing it is what it *forbids*: there is no edge from `occupied`
to `available`. A bed cannot go straight from holding a patient to holding the
next one — it must pass through `cleaning`. That is an infection-control rule
the generated API will enforce with a 403 rather than describe, **for every
caller including the administrator**, because a move the diagram never drew is
not a permission someone lacks; it is a move that does not exist.

`closed` is reachable from `available` and `cleaning` but not from `occupied`:
you cannot close a bed with a patient in it. Discharge them first.

## 5 · Rules

**None on this entity.** The bed-availability judgement from the research —
*is there a bed of the right type free* — is made when an admission is created,
so it belongs on `Admission`.

## 6 · Hooks

**None.** Keeping `Bed.status` in step with admissions is the state machine's
job plus a saga step on `Admission`, not a lifecycle handler here.

## 7 · Cross-entity effects

Two, both landing on `Admission` rather than here, and both recorded so Phase 5
can check they were built:

- admitting a patient must move the chosen bed to `occupied`;
- discharging must move it to `cleaning`.

## 8 · Access

| Operation | Roles |
|---|---|
| read | `doctor`, `nurse`, `ward_manager`, `hospital_manager`, `administrator` |
| create / update / delete | `ward_manager`, `hospital_manager`, `administrator` |
| transition `cleaned` | `nurse`, `ward_manager` |
| transition `close` / `reopen` | `ward_manager`, `hospital_manager` |

The transition restrictions are the first use of `%%rbac` on a *move* rather
than an operation: housekeeping signs a bed off as clean, but only a ward
manager takes one out of service.

Narrower than `Ward` — a receptionist books appointments and never touches beds.

## Open questions

None.
