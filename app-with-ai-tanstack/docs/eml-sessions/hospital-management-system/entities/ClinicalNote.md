# ClinicalNote — dossier

Phase 4, entity 12 of 30. **Child of `Encounter`.**

## Why the four clinical records are children

Stated once here and referenced by `VitalSign`, `Diagnosis` and `Procedure`.
§10.2's three questions, answered for all four:

1. *Useful list away from their owner?* No. A note, an observation or a
   diagnosis without the contact it was recorded in has no patient, no
   clinician, no date and no context. (`Diagnosis` and `Procedure` are the
   arguable ones — an epidemiologist wants all diagnoses, a theatre wants all
   procedures — but both of those are **queries**, not a screen on the
   dashboard.)
2. *Identity depends on the owner?* Yes.
3. *Owner deleted ⇒ meaningless?* Yes.

So all four get `%%entity <X> parent: Encounter`, which puts them as tabs inside
the encounter's window rather than as windows of their own. A missed child here
would put "every note ever written" on the dashboard, which is a screen nobody
opens.

## 1 · Fields

| Column | Type | Modifiers | Help |
|---|---|---|---|
| `id` | string | PK | — |
| `encounter_id` | string | FK, required | The contact this note belongs to. |
| `staff_id` | string | FK, required | Who wrote it. Never changes — an addendum is a new note, not an edit. |
| `note_type` | string | required, enum | What kind of note this is, which decides where it appears in the record. |
| `content` | text | required | The note itself, in the author's words. |
| `recorded_at` | datetime | required | When it was written. |
| `is_confidential` | boolean | required | Restricts the note to the clinical team — used for safeguarding and mental-health entries the wider team should not see. |

## 2 · Enums

```
%%enum NoteType: admission, progress, ward_round, nursing, discharge, addendum
```

`addendum` is how a closed encounter is corrected: the encounter's own state
machine forbids reopening, so a correction is a new note that references the old
one in its text.

## 3 · Relationships

In: `Encounter` (parent), `Staff` (author).

## 4 · Lifecycle · 5 · Rules · 6 · Hooks

**None of the three.** A note is written once and stands.

## 7 · Cross-entity effects

None.

## 8 · Access

read: `doctor`, `nurse`, `administrator` **only**.

**This is the narrowest read in the model, and it is the point of the access
design.** §7 of the research says a billing clerk must not read clinical notes —
this is where that is enforced. Compare `Diagnosis` and `Procedure`, which the
billing clerk *can* read because coding an invoice requires them. The
distinction is deliberate: a diagnosis code is what was concluded, a note is
what was said.

create: `doctor`, `nurse` · update/delete: `administrator` only — a written note
is not edited.
