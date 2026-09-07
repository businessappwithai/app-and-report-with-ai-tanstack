# Medication — dossier

Phase 4, entity 21 of 30. **Standalone**, Pharmacy. A **lookup entity**: nothing
happens *to* a medicine, but two rules read it and would be guesswork without it.

## 1 · Fields

| Column | Type | Modifiers | Help |
|---|---|---|---|
| `id` | string | PK | — |
| `code` | string | UK, required | The catalogue's own code, quoted on a prescription and a stock order. |
| `name` | string | required | The generic name — what a prescription is written in. |
| `brand_name` | string | optional | The brand it is stocked as, where that differs. |
| `form` | string | required, enum | Tablet, injection, cream. Decides how it is given and how it is counted. |
| `strength` | string | required | The strength of one unit, as printed — `500 mg`. |
| `route` | string | required, enum | How it is normally given. |
| `therapeutic_class` | string | required | The class it belongs to. **The duplication rule reads this.** |
| `is_controlled` | boolean | required | Controlled drugs cannot be dispensed by their prescriber. |
| `is_high_alert` | boolean | required | Insulin, heparin, an opioid — an error causes serious harm. |
| `is_active` | boolean | required | Withdrawn medicines are deactivated, never deleted. |
| `contraindication_notes` | text | optional | What the prescriber should know, in the pharmacy's words. |

**Display value** resolves to `name` — the first `name`-ish column, per §3.7.

`strength` is a string and not a number-plus-unit pair, deliberately. `500 mg`,
`5 mg/5 mL` and `40 mg/actuation` are all strengths and none of them is one
number; splitting it would force a shape that fits tablets and breaks inhalers.

## 2 · Enums

```
%%enum MedicationForm: tablet, capsule, liquid, injection, infusion, cream, inhaler, patch, drops, suppository
%%enum MedicationRoute: oral, intravenous, intramuscular, subcutaneous, topical, inhaled, rectal, ophthalmic
```

`MedicationRoute` is used **twice** — here for the medicine's usual route, and on
`PrescriptionItem` for the route this patient is to have it by. One vocabulary,
because a prescription that narrows the route must narrow it to a word the
catalogue would recognise.

`therapeutic_class` is **not** an enum, and that is a judgement rather than an
omission: a classification with hundreds of members that pharmacy maintains is a
column, not a fixed dictionary. Making it an enum would put a schema change
between the pharmacist and their own catalogue.

## 3 · Relationships

| Direction | Other entity | Cardinality | FK lives on |
|---|---|---|---|
| out | `PrescriptionItem` | one-to-many | `PrescriptionItem.medication_id` |

## 4 · Lifecycle

**None.** `is_active` is one flag with no sequence behind it. A medicine is added
to the catalogue and later withdrawn from it; nothing moves it through states.

## 5 · Rules · 6 · Hooks

**None on this entity.** Both rules that read it fire on the prescription, where
the write happens.

## 7 · Cross-entity effects

None outward. Two rules read it inward: `is_controlled` for the segregation
rule, `therapeutic_class` and `is_high_alert` for the duplication and
second-check rules.

## 8 · Access

| Operation | Roles |
|---|---|
| read | `doctor`, `nurse`, `pharmacist`, `hospital_manager`, `administrator` |
| create / update | `pharmacist`, `administrator` |
| delete | `administrator` |

**Only pharmacy maintains the catalogue.** A prescriber who could add a medicine
could add one that does not exist, or one with the controlled flag off — which
is the flag the segregation rule depends on.

## Open questions

**`contraindication_notes` is prose, and prose is not a check.** §8 of the
research puts a full drug formulary with interaction data explicitly out of
scope, so this column is what a prescriber reads and nothing the application can
act on. The duplication rule on the next entity is what the model can actually
enforce, and it is narrower than "does this drug clash" sounds. Named plainly
rather than implied.
