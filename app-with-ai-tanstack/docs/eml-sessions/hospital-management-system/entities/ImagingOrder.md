# ImagingOrder — dossier

Phase 4, entity 19 of 30. **Standalone**, Diagnostics. The same shape as
`LabOrder` and deliberately so — but not the same lifecycle, because imaging is
booked and laboratory work is not.

## 1 · Fields

| Column | Type | Modifiers | Help |
|---|---|---|---|
| `id` | string | PK | — |
| `order_number` | string | UK, required | The department's own number for the request. Generated, never typed. |
| `encounter_id` | string | FK, required | The contact it was requested during. |
| `ordered_by_id` | string | FK, required | Who is responsible, and who a critical finding is escalated to. |
| `modality` | string | required, enum | What kind of imaging. Decides the room and the equipment. |
| `body_part` | string | required | What is to be imaged, in the words of the request. |
| `priority` | string | required, enum | How fast it is needed. |
| `status` | string | required, enum | Where the request has got to. |
| `contrast_used` | boolean | required | Whether contrast was given. Changes the preparation, the safety checks and the price. |
| `is_escalated` | boolean | required | Written by the escalation saga. |
| `ordered_at` | datetime | required | When it was raised. |
| `scheduled_for` | datetime | optional | When it is booked for. |
| `performed_at` | datetime | optional | When it was carried out. |
| `clinical_question` | text | optional | The question the study is meant to answer. |

**`clinical_question` is the column that separates a report from a
description.** A radiologist reports *against* the question asked; without it
they can only describe what is on the image and leave the ordering clinician to
work out whether it answers anything.

## 2 · Enums

```
%%enum ImagingModality: x_ray, ct, mri, ultrasound, mammography, fluoroscopy, nuclear_medicine
%%enum ImagingOrderStatus: requested, scheduled, performed, reported, cancelled
```

`OrderPriority` is reused from `LabOrder` rather than duplicated — see that
dossier.

## 3 · Relationships

| Direction | Other entity | Cardinality | FK lives on |
|---|---|---|---|
| in | `Encounter` | many-to-one | `ImagingOrder.encounter_id` |
| in | `Staff` | many-to-one | `ImagingOrder.ordered_by_id` |
| out | `ImagingReport` | one-to-many | `ImagingReport.imaging_order_id` |

**Two corrections to the seed, both of which changed what the database will
enforce.**

`Patient ||--o{ ImagingOrder` is removed, for the reason given under `LabOrder`.

`ImagingOrder |o--o| ImagingReport` became `||--o{`. The seed drew it
one-to-one-optional, which reads correctly in English — one study, one report —
and is wrong twice over. The generated migration **emits a foreign-key
constraint for a declared one-to-many relationship and nothing else**, so a
`|o--o|` edge would have left `imaging_order_id` a column the dictionary
describes and the schema does not enforce. And an addendum is a second report
against the same study, which the one-to-one form forbids outright.

## 4 · Lifecycle — `ImagingOrderLifecycle`

```
[*] --> requested
requested --> scheduled : schedule
requested --> cancelled : cancel
scheduled --> performed : perform
scheduled --> cancelled : cancel
performed --> reported : report
```

Five states where the laboratory has four, and the extra one is `scheduled`: an
image needs a room, a machine and a slot, and "requested but not yet booked" is
a worklist somebody works through. A specimen needs none of that.

As with the laboratory, **there is no edge from `requested` to `reported`** and
no cancellation once the study has been performed — the machine time was spent
and the images exist whether or not anyone reads them.

## 5 · Rules

None on this entity. The judgement is about the finding, so it lives on
`ImagingReport`.

## 6 · Hooks

```
%%hook beforeCreate stampImagingOrderNumber on ImagingOrder
```

## 7 · Cross-entity effects

Inbound only, from `CriticalFindingEscalation`.

## 8 · Access

| Operation | Roles |
|---|---|
| read | `doctor`, `nurse`, `radiologist`, `billing_clerk`, `hospital_manager`, `administrator` |
| create | `doctor`, `nurse` |
| update | `doctor`, `nurse`, `radiologist`, `receptionist` |
| delete | `administrator` |

`receptionist` may update, and only for one reason: booking the study is
scheduling work, and `%%rbac role:receptionist|radiologist on
ImagingOrder.schedule` is what limits that to the one transition. Reception
cannot mark a study performed or reported.

## Open questions

**The role vocabulary has no radiographer.** `StaffRole` names `radiologist`
and nothing else on the imaging side, so the `perform` transition — which in
practice is a radiographer's, not a radiologist's — is assigned to
`radiologist`. Two ways out: add `radiographer` to `StaffRole` and split the
transition, or accept the collapse and record it. The second is defensible for a
model this size; the first is one enum value and one `%%rbac` line. **Your
call — I have carried the collapse for now and flagged it rather than deciding
it quietly.**
