# LabResult — dossier

Phase 4, entity 18 of 30. **Child of `LabOrder`** — it renders as a tab of the
request, which is how anyone reads it.

## 1 · Fields

| Column | Type | Modifiers | Help |
|---|---|---|---|
| `id` | string | PK | — |
| `lab_order_id` | string | FK, required | The request this value answers. |
| `analyte` | string | required | What was measured — haemoglobin, sodium, CRP. One order commonly produces several. |
| `value_numeric` | decimal | optional | The value, where the test produces a number. |
| `value_text` | string | optional | The result in words, where it produces none — an organism named, positive or negative. |
| `unit` | string | optional | The unit the number is in. A number without its unit is not a result. |
| `reference_low` | decimal | optional | Bottom of the normal range this value is read against. |
| `reference_high` | decimal | optional | Top of it. |
| `abnormal_flag` | string | required, enum | How the value reads against its range. |
| `verified_by_id` | string | FK, optional | Who verified it. Empty until someone has. |
| `verified_at` | datetime | optional | When. |
| `resulted_at` | datetime | required | When the analyser produced the value. |

**`value_numeric` and `value_text` are both optional, and that is the shape a
rule has to make safe.** A haemoglobin is a number; a blood culture is the name
of an organism; a pregnancy test is a word. One column cannot be both without
throwing away the ability to compare a number to its range — which is the whole
point of `reference_low` and `reference_high`. Two optional columns, and a rule
that refuses a row carrying neither, is the honest version.

**The reference range is stored on the result, not looked up.** Ranges are
revised, and they differ by age and sex; a result printed five years from now
must show the range it was actually read against, not today's.

## 2 · Enums

```
%%enum AbnormalFlag: normal, low, high, critical_low, critical_high
```

`critical_low` and `critical_high` are not louder versions of `low` and `high`.
They are the values that mean *stop and telephone someone*, and the model has to
treat them differently or the distinction is decoration.

## 3 · Relationships

| Direction | Other entity | Cardinality | FK lives on |
|---|---|---|---|
| in | `LabOrder` | many-to-one | `LabResult.lab_order_id` |
| in | `Staff` | many-to-one | `LabResult.verified_by_id` |

## 4 · Lifecycle

**None.** A result is produced, verified and then immutable. Verification is one
column and one moment, not a sequence anyone moves it through — and the order
above it already carries the states that matter.

## 5 · Rules — two, and they do different jobs

**`labResultValueGate`** · `beforeCreate` · refuses a result carrying neither a
number nor text. This is the rule the two-column shape above obliges me to
write; without it the shape is a hole rather than a design.

**`criticalResultGate`** · `afterCreate` · fires `CriticalResultEscalation` when
the flag is `critical_high` or `critical_low`.

§5 of the research asks the §3.4 question of this decision — *does it merely
decide, or must it also act?* — and answers **act**: "a critical result must
escalate, not just be flagged". So it is a `trigger-workflow` action, not a
decision graph that colours a row red. A model that stops at deciding produces
an application where a potassium of 7 is a red cell on a screen nobody has open.

## 6 · Hooks

**None.**

## 7 · Cross-entity effects — `CriticalResultEscalation`

The model's **first saga**, and the first thing in it that writes to a row other
than the one being saved:

```
%%step B UpdateEntity entity: LabOrder targetField: lab_order_id field: is_escalated value: true
%%step C UpdateEntity entity: LabOrder targetField: lab_order_id field: priority value: stat
```

Two writes onto the parent request: it is flagged, and it goes to the top of
every worklist that sorts on priority. `targetField` names the foreign key on
the triggering row, so the saga reaches the order without being told its id.

**What it deliberately does not do** is send anything. There is no notification
entity in this model and I have not invented one: the escalation is a state the
application can act on and a worklist a human is looking at, which is what the
model can honestly promise. If you want a telephoned-and-acknowledged record —
who was told, when, and by whom — that is an entity, and this is the moment to
say so.

## 8 · Access

| Operation | Roles |
|---|---|
| read | `doctor`, `nurse`, `lab_technician`, `administrator` |
| create / update | `lab_technician` |
| delete | `administrator` |

Narrower than `LabOrder` by exactly one role: **`billing_clerk` reads the
request and not the value.** Only the laboratory writes a result — a clinician
who could type one could type one that was never measured.

## Open questions

**Nobody acknowledges an escalation.** The saga raises the flag; no column
records that a human received it. That is the gap named in §7 above, and it is
the one place in this group where the model is weaker than the practice. Say the
word and I will add an `acknowledged_by_id` / `acknowledged_at` pair to
`LabOrder` and `ImagingOrder`, which is the cheap version, or a full
`CriticalAlert` entity, which is the honest one.
