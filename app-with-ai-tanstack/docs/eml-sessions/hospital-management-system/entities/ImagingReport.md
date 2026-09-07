# ImagingReport — dossier

Phase 4, entity 20 of 30. **Child of `ImagingOrder`.** Two thirds of the way.

## Why it is not shaped like a `LabResult`

§6 of the research names this as vocabulary that must not be swapped:
**a result is not a report.** A lab result is a measurement against a range —
a number, a unit, a flag, and a rule can compare it to a threshold. An imaging
report is a radiologist's prose. Modelling the second as a variation of the
first would mean either a `value_numeric` nobody fills in or a report squeezed
into a `value_text` column, and every screen and every rule downstream inherits
the confusion.

## 1 · Fields

| Column | Type | Modifiers | Help |
|---|---|---|---|
| `id` | string | PK | — |
| `imaging_order_id` | string | FK, required | The study this report interprets. |
| `doctor_id` | string | FK, required | The radiologist who read it and signed it. |
| `findings` | text | required | What is visible on the study, described. |
| `impression` | text | required | What it means. |
| `is_addendum` | boolean | required | Marks a later report amending an earlier one rather than replacing it. |
| `is_critical` | boolean | required | A finding that has to be communicated now. |
| `reported_at` | datetime | required | When it was signed. |

**`findings` and `impression` are two columns because they are two documents.**
The ordering clinician reads the impression and acts on it; the findings are
what another radiologist re-reads when the answer is disputed. Merging them into
one `report` column is the change that makes the impression unfindable.

**`is_addendum` exists because a report is never edited.** A decision was made on
the first version, so the first version has to survive. An amendment is a second
row, marked as one — which is exactly why the relationship to `ImagingOrder`
had to be one-to-many.

## 2 · Enums

**None.** Every column here is prose, a boolean or a reference. That is itself
the point of the entity.

## 3 · Relationships

| Direction | Other entity | Cardinality | FK lives on |
|---|---|---|---|
| in | `ImagingOrder` | many-to-one | `ImagingReport.imaging_order_id` |
| in | `Doctor` | many-to-one | `ImagingReport.doctor_id` |

`Doctor`, not `Staff` — unlike a clinical note or an observation, which any
member of staff records. Only a doctor signs a radiology report, and the seed
drew it that way.

## 4 · Lifecycle

**None**, for the reason in §1: a signed report is immutable, and an amendment
is a new row.

## 5 · Rules — `criticalFindingGate`

`afterCreate`, and the mirror of `criticalResultGate`:

```
%%action escalateCriticalFinding trigger-workflow when: isCritical == true workflow: CriticalFindingEscalation
```

The symmetry is deliberate. A critical finding on an image and a critical value
in a tube are the same event to the ward that has to hear about it, so they
escalate the same way and the two worklists behave alike.

## 6 · Hooks

**None.**

## 7 · Cross-entity effects — `CriticalFindingEscalation`

```
%%step B UpdateEntity entity: ImagingOrder targetField: imaging_order_id field: is_escalated value: true
%%step C UpdateEntity entity: ImagingOrder targetField: imaging_order_id field: priority value: stat
```

The same two writes onto the parent order, and the same limit: it changes state,
it does not send anything. See the open question on `LabResult`.

## 8 · Access

| Operation | Roles |
|---|---|
| read | `doctor`, `nurse`, `radiologist`, `administrator` |
| create / update | `radiologist` |
| delete | `administrator` |

`billing_clerk` reads the order and not the report — the same line as the
laboratory.

## Open questions

None here. The radiographer question is on `ImagingOrder`.
