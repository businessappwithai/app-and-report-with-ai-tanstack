# Diagnosis — dossier

Phase 4, entity 14 of 30. **Child of `Encounter`** — see `ClinicalNote.md`.

## 1 · Fields

| Column | Type | Modifiers | Help |
|---|---|---|---|
| `id` | string | PK | — |
| `encounter_id` | string | FK, required | The contact this conclusion was reached in. |
| `staff_id` | string | FK, required | The clinician who recorded it and is accountable for it. |
| `diagnosis_code` | string | required | The classification code, from whichever coding standard the hospital uses. What billing and reporting key on. |
| `description` | string | required | The diagnosis in words, as it should read on a letter. |
| `diagnosis_type` | string | required, enum | Whether this is the main reason for the contact or something alongside it. |
| `diagnosed_at` | datetime | required | When it was recorded. |
| `is_chronic` | boolean | required | Whether this is a long-term condition rather than something arising from this contact. Chronic diagnoses carry forward. |

## 2 · Enums

```
%%enum DiagnosisType: primary, secondary, provisional, differential, complication
```

`provisional` and `differential` matter: a working diagnosis and a list of what
else it might be are both recorded, and neither is a conclusion. Billing keys on
`primary` only.

## 4 · Lifecycle · 5 · Rules · 6 · Hooks

**None.**

## 7 · Cross-entity effects

`encounterCloseGate` on `Encounter` refuses a close with no diagnosis — that
rule lives there, on the write it guards.

## 8 · Access

read: `doctor`, `nurse`, `billing_clerk`, `administrator`

**The billing clerk reads this and not `ClinicalNote`.** Coding an invoice
requires the diagnosis code; it does not require the prose the clinician wrote.
That is the segregation from §7 of the research at its finest grain, and it is
the one place I would expect an information-governance reviewer to look first.

create: `doctor`, `nurse` · update/delete: `administrator`
