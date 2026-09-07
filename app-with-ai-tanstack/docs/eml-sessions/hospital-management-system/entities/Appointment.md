# Appointment — dossier

Phase 4, entity 9 of 30. A booked future slot. Becomes an `Encounter` when the
patient actually arrives — the two are different things and the model keeps them
apart, per §6 of the research.

## 1 · Fields

| Column | Type | Modifiers | Help |
|---|---|---|---|
| `id` | string | PK | — |
| `appointment_number` | string | UK, required | The reference quoted to the patient in their letter and on the phone. |
| `patient_id` | string | FK, required | Who the appointment is for. |
| `doctor_id` | string | FK, required | The doctor the patient is booked to see. |
| `department_id` | string | FK, required | The department running the clinic. |
| `scheduled_at` | datetime | required | When the patient is expected. |
| `duration_minutes` | integer | required | How long the slot is, which is what the clinic template allocates. |
| `appointment_type` | string | required, enum | What kind of visit this is. Decides the slot length a clinic offers. |
| `status` | string | required, enum | Where the booking has got to. Driven by the lifecycle. |
| `reason` | text | optional | Why the patient is coming, in the referrer's or the patient's words. |
| `booked_at` | datetime | required | When the booking was made — the clock a "time to be seen" measure runs from. |
| `cancellation_reason` | string | optional | Why it was cancelled or missed. Empty unless it was. |

## 2 · Enums

```
%%enum AppointmentType: new_patient, follow_up, procedure, review, telemedicine
%%enum AppointmentStatus: requested, confirmed, checked_in, completed, cancelled, no_show
```

## 3 · Relationships

In: `Patient`, `Doctor`, `Department`. Out: `Encounter` (one-to-one optional —
the appointment that was attended).

## 4 · Lifecycle — `AppointmentLifecycle`

```
[*] --> requested
requested --> confirmed  : confirm
requested --> cancelled  : cancel
confirmed --> checked_in : check_in
confirmed --> cancelled  : cancel
confirmed --> no_show    : mark_no_show
checked_in --> completed : complete
completed --> [*]
cancelled --> [*]
no_show   --> [*]
```

`no_show` is reachable only from `confirmed`, never from `checked_in`: once a
patient has arrived they cannot have failed to. And there is no edge from
`cancelled` back to anything — a cancelled appointment is rebooked as a new one,
so the original stays as the record that it was cancelled.

## 5 · Rules

**`appointmentSlotGate`** on `beforeCreate`, and it must **act**:

- refuse the booking if the doctor is not `accepts_new_patients` and this is a
  `new_patient` appointment;
- refuse if the requested slot is in the past.

Both are `validation-error` actions — they stop the write rather than annotate
it. Double-booking is the third check a real system makes and it is **not** here:
it needs to query other appointments in a time range, which a decision table over
the incoming record cannot do. Named as a gap rather than half-built.

## 6 · Hooks

```
%%hook beforeCreate stampAppointmentNumber on Appointment
```

## 7 · Cross-entity effects

Checking in should create the `Encounter`. Recorded here, built as a saga at
Phase 5, checked at Gate D.

## 8 · Access

read: `doctor`, `nurse`, `receptionist`, `ward_manager`, `hospital_manager`,
`administrator` · create/update: `receptionist`, `doctor`, `hospital_manager`,
`administrator` · `cancel`/`mark_no_show`: `receptionist`, `doctor`,
`hospital_manager`

## Open questions

Double-booking, above.

---

## Phase 6 repair — `refuseClosedList` moved to a handler

`appointmentSlotGate` used to carry two actions. `refuseClosedList` read
`acceptsNewPatients`, which lives on `Doctor` — and Phase 6 established that the
generated rules engine evaluates a rule against the record being written and
nothing else, so it would never have fired.

It is now `%%hook beforeCreate checkDoctorAcceptsNewPatients on Appointment`.
The rule keeps `refusePastSlot`, whose `scheduledAt` is a column of the booking
itself.
