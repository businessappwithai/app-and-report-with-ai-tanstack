# PrescriptionItem — dossier

Phase 4, entity 23 of 30. **Child of `Prescription`.** Where the §5 "drug clash"
rule lands — and where I have to be precise about what it can and cannot catch.

## 1 · Fields

| Column | Type | Modifiers | Help |
|---|---|---|---|
| `id` | string | PK | — |
| `prescription_id` | string | FK, required | The prescription this line belongs to. |
| `medication_id` | string | FK, required | Which medicine, from the catalogue. |
| `dose` | string | required | How much at once — `500 mg`, `10 mL`. |
| `route` | string | required, enum | How it is given for this patient. |
| `frequency` | string | required | How often, in the words the prescription is written in. |
| `quantity` | decimal | required | How much to dispense in total. What pharmacy counts out, and what stock will be decremented by. |
| `is_prn` | boolean | required | Given as required rather than on a schedule. |
| `duration_days` | integer | optional | How long the course runs. Empty for a medicine taken indefinitely. |
| `second_check_by_id` | string | FK, optional | The second qualified person who checked a high-alert medicine. |
| `instructions` | text | optional | What goes on the label — with food, before bed. |

**`medication_id` is a reference and not a typed name**, and that is the column
the two rules depend on. `is_controlled`, `is_high_alert` and
`therapeutic_class` are the catalogue's facts; a prescriber typing a drug name
would supply none of them, and both rules would have nothing to read.

`frequency` is free text for the same reason `strength` is on `Medication`: *three
times a day*, *at night*, *every four hours as required* and *once weekly* are
all frequencies, and no enum covers them without excluding a real prescription.

## 2 · Enums

Reuses `MedicationRoute`. None of its own.

## 3 · Relationships

| Direction | Other entity | Cardinality | FK lives on |
|---|---|---|---|
| in | `Prescription` | many-to-one | `PrescriptionItem.prescription_id` |
| in | `Medication` | many-to-one | `PrescriptionItem.medication_id` |
| in | `Staff` | many-to-one | `PrescriptionItem.second_check_by_id` |

## 4 · Lifecycle

**None.** The prescription carries the states; an item is written and then
belongs to whatever the prescription is doing.

## 5 · Rules — two, and one of them needs its limits stated plainly

**`requireSecondCheck`** · refuses a high-alert medicine added with no second
check recorded. This is why `is_high_alert` is a column and not decoration: the
flag causes a refusal.

**`refuseTherapeuticDuplicate`** · refuses an item when the patient is already on
an active medicine of the same `therapeutic_class`.

### What this rule is, and what it is not

§5 of the research asks: *does this drug clash with something the patient is
already on?* — and answers that it must **refuse**, not merely warn. It refuses.
But the question is larger than the model can answer, and here is the honest
account of the gap:

| The question | What this model does |
|---|---|
| A second medicine of the same therapeutic class | **Refused.** This is real therapeutic duplication and it is the commonest prescribing error a system without a formulary can catch |
| A drug–drug interaction between different classes | **Not detected.** It needs an interaction reference database, which §8 of the research puts explicitly out of scope |
| A drug the patient is allergic to | **Not detected.** `Patient.known_allergies` is free text — you declined a `PatientAllergy` entity at Gate B — and a rule cannot match `penicillin` against *"reacts badly to penicillins — rash"* |

I am naming this rather than letting "drug clash rule: done" stand, because a
safety rule that is believed to do more than it does is worse than one that was
never claimed. The offer from the `Patient` dossier stands: a `PatientAllergy`
entity linked to `Medication` closes the third row, and it is two entities to
re-walk.

## 6 · Hooks

**None.**

## 7 · Cross-entity effects

`quantity` is what the stock decrement will read at Phase 5. Nothing else.

## 8 · Access

| Operation | Roles |
|---|---|
| read | `doctor`, `nurse`, `pharmacist`, `administrator` |
| create | `doctor` |
| update | `doctor`, `pharmacist` |
| delete | `administrator` |

A nurse reads the items — they are what is administered on the ward — and writes
none of them.

## A standing assumption, stated once for the whole model

Four rules now read values that are **not columns of the row being written**:
`bedStatus` and `bedTypeSuitable` from the referenced bed, `diagnosisCount` and
`consentCount` from child rows, and now `hasControlledItem`, `isHighAlert` and
`activeSameClassCount`. Every one of them is a value the rules engine must be
given as rule context.

This has been the pattern since entity 11 and it is how the decision tables in
the generated application are written. **It is on the Phase 6 list to verify
against a generated application** rather than assumed to the end — that is the
one place this group could be wrong in a way the checker cannot see.

## Open questions

The allergy gap above. Everything else is decided.

---

## Phase 6 repair — the duplication rule became a handler; the second check kept its rule

Phase 6 split this entity's two rules.

**`requireSecondCheck` survives as a rule**, because `is_high_alert` is now a
column of the item — copied from the catalogue by
`%%hook beforeCreate copyMedicationFlags on PrescriptionItem`. It is the same
copy-at-the-time-of-writing pattern as `InvoiceLine.unit_price`, and it is
better modelling besides: the flag as it stood when the medicine was prescribed
is what an audit asks about, not the flag as it stands today.

**`refuseTherapeuticDuplicate` could not be saved.** `activeSameClassCount` is a
query across the patient's other prescriptions; no column carries it. It is
`%%hook beforeCreate refuseTherapeuticDuplicate on PrescriptionItem`.

The table in §5 above is unchanged in substance — what the check catches and what
it does not is the same. What changed is where it runs.

**The section heading in the model is now `High Alert Check Gate`**, because the
rule that remains is the second-check one.
