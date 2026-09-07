# Ward — dossier

Phase 4, entity 2 of 30. Walked after `Department` because a ward belongs to
one, and before `Bed` because a bed belongs to a ward.

## 1 · Fields

| Column | Type | Modifiers | Help text |
|---|---|---|---|
| `id` | string | PK | — |
| `name` | string | UK, required | What the ward is called on the signage and in conversation — "Coronary Care", "Ward 3B". Unique, because a patient sent to the wrong ward of the same name is a real incident. |
| `code` | string | UK, required | The short code used on bed boards and transfer notes, e.g. CCU. |
| `department_id` | string | FK, required | The department that runs this ward. |
| `ward_type` | string | required, enum | What kind of ward it is. Decides which patients may be admitted here and what level of nursing is required. |
| `bed_capacity` | integer | required | How many beds this ward is commissioned for. The count of bed records should match it; a mismatch means beds were added or closed without the establishment being updated. |
| `floor` | string | optional | Which floor to find it on. Used by porters moving patients. |
| `phone_extension` | string | optional | The nurses' station number. |
| `is_active` | boolean | required | Untick when a ward closes, rather than deleting it — past admissions must still resolve to somewhere. |

## 2 · Enums

```
%%enum WardType: general, icu, hdu, maternity, paediatric, isolation, day_case
```

Chosen because each one carries a different admission constraint a clinician
would recognise: an ICU bed is not interchangeable with a general one, and a
paediatric admission does not belong on an adult ward. `hdu` is high-dependency
— between ICU and general — and is a real distinction in bed management, which
is the job this enum exists to serve.

## 3 · Relationships

| Direction | Other entity | Cardinality | FK lives on |
|---|---|---|---|
| in | `Department` | many-to-one | `Ward.department_id` |
| out | `Bed` | one-to-many | `Bed.ward_id` |
| out | `Admission` | one-to-many | `Admission.ward_id` |

## 4 · Lifecycle

**None.** Like `Department`, a ward is open or closed and `is_active` carries it.
A ward being *full* is a computed fact about its beds, not a state of the ward —
modelling it as one would mean a status that has to be kept in step with reality
by something, and nothing would.

## 5 · Rules

**None on this entity.** The bed-availability judgement from the research lives
on `Admission`, where the decision is actually made, not here.

## 6 · Hooks

**None.**

## 7 · Cross-entity effects

Closing a ward does not cascade to its beds or its past admissions. It should
arguably prevent *new* admissions to it — that belongs on `Admission` as a rule
and is noted there rather than invented here.

## 8 · Access

| Operation | Roles |
|---|---|
| read | `doctor`, `nurse`, `ward_manager`, `receptionist`, `hospital_manager`, `admin` |
| create / update / delete | `ward_manager`, `hospital_manager`, `admin` |

Narrower than `Department`, which everyone reads. A ward list is operational
rather than reference data: billing, pharmacy, the lab and stores have no
business resolving one, and a role that reads nothing it does not need is the
point of the access model.

**This is the first entity where read is restricted**, so it is the first that
will show a role count other than "all" in the viewer's Access tab.

## Open questions

`bed_capacity` duplicates something derivable — the number of `Bed` records on
this ward. It is kept because the two mean different things: capacity is what
the ward is *commissioned* for, the bed count is what it *has*, and the gap
between them is a fact a ward manager wants to see rather than one the model
should define away. Say if you would rather drop it.
