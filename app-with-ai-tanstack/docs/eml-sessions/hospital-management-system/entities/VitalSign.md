# VitalSign — dossier

Phase 4, entity 13 of 30. **Child of `Encounter`** — see `ClinicalNote.md` for
the argument.

One set of observations taken at one moment. Every measurement is optional
because a real set is often partial: a nurse takes a pulse and a temperature
without a respiratory rate.

## 1 · Fields

| Column | Type | Modifiers | Help |
|---|---|---|---|
| `id` | string | PK | — |
| `encounter_id` | string | FK, required | The contact these observations were taken during. |
| `staff_id` | string | FK, required | Who took them. |
| `recorded_at` | datetime | required | When they were taken — not when they were typed in. |
| `temperature_c` | decimal | optional | Body temperature in degrees Celsius. |
| `pulse_bpm` | integer | optional | Heart rate in beats per minute. |
| `systolic_bp` | integer | optional | Systolic blood pressure in mmHg. |
| `diastolic_bp` | integer | optional | Diastolic blood pressure in mmHg. |
| `respiratory_rate` | integer | optional | Breaths per minute. |
| `oxygen_saturation` | integer | optional | Peripheral oxygen saturation as a percentage. |
| `early_warning_score` | integer | optional | The aggregate score these observations produce. Above the escalation threshold it means call someone. |

## 2 · Enums · 4 · Lifecycle · 5 · Rules · 6 · Hooks

**None.** The escalation judgement — *is this set of observations a deteriorating
patient* — is real, and it is deliberately **not** modelled as a rule here: it
needs a score computed across several columns and compared to a threshold that
varies by patient. Naming it as out of scope is honester than a rule that fires
on one column.

## 8 · Access

read: `doctor`, `nurse`, `administrator` · create: `doctor`, `nurse` ·
update/delete: `administrator` only — an observation is a measurement, and
measurements are not revised.
