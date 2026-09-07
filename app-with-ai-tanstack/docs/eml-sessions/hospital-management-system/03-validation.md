# Validation log

One line per step that touched the `.mmd`, per §10.0. The evidence that the
model was built clean rather than cleaned up at the end.

| Step | Before | Fixer changed | After |
|---|---|---|---|
| Phase 3 — seed, as §10.3's example is written | — | nothing | **0 errors, 30 warnings** — one `EML102` per entity. §10.3 says to expect exactly this, so it reads as correct |
| Phase 3 — seed, entity blocks written over three lines | 0e 30w | nothing | **0 errors, 0 warnings, 46 notes** — the `EML102`s are gone; the notes are `EML125`, one per relationship whose foreign key has not been declared yet |

## The seed had to be rewritten, and the specification is why

§10.3's worked example declares each seed entity on one line:

```
    Member { string id PK }
```

**Neither reader accepts that form.** On a minimal document the checker reports
`EML004 Empty document: no entities` plus `EML120/EML121 Relationship references
undeclared entity`; the generator's own parser reads **zero** entities from it,
because `MermaidParser` matches an entity block on `^<Name>\s*\{$` — the brace
has to end the line.

It did not fail loudly here because this seed also carries `%%category` and
`%%entity … help:` directives, from which the checker recovers the entity names.
So the document reported `0 errors` and one `EML102` per entity — and §10.3 says
in as many words to *expect* one `EML102` per entity and not to act on them.
The warning the protocol presents as a progress bar was in fact the parser
failing to see the `string id PK` that was written right there on the line.

Found by opening the seed in the viewers, which drew nothing: the checker said
OK, the picture said zero entities, and only one of those can be right. This is
the case for putting the viewer in the loop rather than trusting the verdict
line alone.

**Both halves of §10.3 need correcting**: the example must use the block form,
and the expected-diagnostic guidance must name `EML125` notes rather than
`EML102` warnings.
| Phase 4 · 1/30 `Department` | 0e 0w 46i | nothing | **0 errors, 0 warnings, 47 notes** — one more `EML125`, from the `head_doctor_id` reference the ERD deliberately draws no line for |
| Phase 4 · 2/30 `Ward` | 0e 0w 47i | nothing | **0 errors, 0 warnings, 46 notes** — one fewer, `Ward.department_id` resolved its `EML125` |
| Phase 4 · 3/30 `Bed` | 0e 0w 46i | nothing | **0 errors, 0 warnings, 45 notes** — first state machine merged; `role:admin` → `role:administrator` applied to Department and Ward retrospectively, and the spurious Admin role is gone |
| Phase 4 · 4/30 `Staff` | 0e 0w 45i | nothing | **0 errors, 0 warnings, 44 notes** — first hook; `work_email` and `phone` carry semantic types, so the dictionary renders them as an email and a phone control rather than text boxes |
| Phase 4 · 5–6/30 `Doctor`, `Nurse` | 0e 0w 44i | nothing | **0 errors, 0 warnings, 44 notes** — net level: two FKs resolved their `EML125`, and the new `Ward → Nurse` edge raised one |
| Phase 4 · 7–8/30 `Patient`, `InsurancePolicy` | 0e 0w 44i | nothing | **0 errors, 0 warnings, 43 notes** — second state machine and second hook; 11 roles now named, and the role-reach spread starts to show the segregation |
| Phase 4 · 9–11/30 `Appointment`, `Encounter`, `Admission` | 0e 0w 43i | nothing | **0 errors, 0 warnings, 33 notes** — ten notes cleared by the foreign keys these three declare; three state machines and the first four business rules, all four of which *act* rather than merely decide |
| Phase 4 · 12–16/30 `ClinicalNote`, `VitalSign`, `Diagnosis`, `Procedure`, `Consent` | 0e 0w 33i | nothing | **0 errors, 1 warning, 24 notes** → after the fix below, **0 errors, 0 warnings, 24 notes** — nine notes cleared by the foreign keys these five declare; four children resolved onto `Encounter`; sixth state machine and the fifth rule |

## The one warning this walkthrough has produced

`EML119` on `Consent.given_by`: a column whose name ends `_by` reads to the
dictionary as a reference to a member of staff, and this one is an enum naming
the *capacity* consent was given in — patient, next of kin, guardian, court
order. Left alone it would have generated a text box where the form promises a
lookup.

Renamed `given_by` → `giver_type` and `given_by_name` → `giver_name`, which is
the fix rather than a suppression: the naming convention is load-bearing (§3.7),
so the column that is not a reference is the one that has to move. Re-checked
clean.
| Phase 4 · 17–20/30 `LabOrder`, `LabResult`, `ImagingOrder`, `ImagingReport` | 0e 0w 24i | nothing | **0 errors, 0 warnings, 15 notes** — nine notes cleared; two more children resolved; the seventh and eighth state machines, the **first two sagas**, three more rules and two more hooks. `scripts/check-model.mjs` **20/20** after the `national_health_id` rename below |

## A second `_id` trap, found by the scorer rather than the checker

`Patient.national_health_number` was `national_health_id`. The checker says
nothing — `EML119` fires only where the prefix resolves to a real entity, and
there is no `NationalHealth` — but `scripts/check-model.mjs` audits the
convention itself and failed 19/20 on it. It is the same fault as
`Consent.given_by` one step earlier: a column that is not a reference wearing a
reference's suffix, which downgrades it to a String in the Application
Dictionary.

Renamed to `national_health_number`, which also matches `medical_record_number`
beside it. **Run both tools, not one** — the checker and the scorer disagree
about this class of fault, and the scorer is right.
| Phase 4 · 21–23/30 `Medication`, `Prescription`, `PrescriptionItem` | 0e 0w 15i | nothing | **0 errors, 3 warnings → 0 errors, 0 warnings, 12 notes** — ninth state machine, three more rules, one more hook; scorer still 20/20 |

## The three warnings, and what each one taught

Two were `EML124 Duplicate relationship: Staff ||--o{ Prescription`. I had drawn
three edges — `prescribes`, `verifies`, `dispenses` — for three foreign keys to
the same entity. **A Mermaid ERD relationship names a pair, not a column**, so
the label does not make them distinct. One edge survives (the required
`prescribed_by_staff_id`); the other two resolve by the `_id` naming convention
and get a `Table Direct` control without a database constraint, which is the
same accepted trade as `Department.head_doctor_id`.

The third was `EML146 Prescription.status has no %%field enum binding`, raised
in the window between writing the entity block and writing its directives. Worth
noting that the checker catches an unbound status column immediately — an
unbound one would have given the form free text and left the state machine
acting on values it had never heard of.
| Phase 4 · 24–27/30 `ChargeableItem`, `Invoice`, `InvoiceLine`, `Payment` | 0e 0w 12i | nothing | **0 errors, 0 warnings, 4 notes** — the tenth state machine (nine states, the largest in the model), five more rules, three more hooks, two more sagas. The last `EML125` cleared. Scorer 20/20 |

## The defect this group exposed, six gates late

Writing `Invoice` raised `EML502 FK attribute "Prescription.verified_by_staff_id"
has no relationship to "VerifiedByStaff"` — and following it up found a fault
running back to entity 4.

**The generator resolves a reference from the column name alone.** The contract
is in `foreignKeys` in `appwithai-language.json` and implemented in
`nestjs-backend.generator.ts`: a `_by` or `_by_id` suffix resolves to the model's
person entity; otherwise `<entity>_id` resolves to `bus_<entity>`; **anything
that resolves to nothing is stored as a plain string — no lookup, no display
name, the raw uuid rendered in every grid and form.**

`verified_by_staff_id` matches neither rule. It resolves to `bus_verified_by_staff`,
which does not exist. Nine columns across six entities were written that way:

```
Consent.witnessed_by_staff_id      LabOrder.ordered_by_staff_id
LabResult.verified_by_staff_id     ImagingOrder.ordered_by_staff_id
Prescription.prescribed_by_staff_id, verified_by_staff_id, dispensed_by_staff_id
PrescriptionItem.second_check_by_staff_id
Payment.received_by_staff_id
```

All renamed `*_by_id`, which is the documented person-role suffix and resolves to
`Staff`. `Department.head_doctor_id` was the tenth and a different case — it
resolves to `HeadDoctor` rather than `Doctor` — renamed `doctor_id`, with the
reason written into its help text.

**Why it hid for six gates.** `EML502` fires only where the column has no drawn
relationship, and most of these had one. A drawn edge gives the database its
foreign-key constraint; it does **not** feed the Application Dictionary, which
reads the name. So the checker was quiet about eight columns that would have
generated a form full of raw uuids — and the one it did report, it reported the
moment I stopped drawing an edge for it.

This is the second time in this walkthrough that a column name has silently
decided a control type (`Consent.given_by`, `Patient.national_health_id`), and
the first time it was invisible to every tool. §3.7's naming convention deserves
to be a step in §10.4's per-entity checklist rather than a paragraph the model is
assumed to remember.
| Phase 4 · 28–30/30 `Supplier`, `InventoryItem`, `StockTransaction` | 0e 0w 4i | nothing | **0 errors, 0 warnings, 1 note** — two more rules, one more hook, the fifth saga. **Phase 4 complete: 30 of 30.** Scorer 20/20 |

## The one note that remains, and why it stays

`EML502 Department.doctor_id has no relationship to "Doctor"` is the only
diagnostic left in the document, and it is the deliberate decision taken at
entity 1: drawing the edge would make `Department` and `Doctor` mutually
dependent — `Doctor → Staff → Department` already carries a required foreign key
— so the head-of-department reference is a lookup the dictionary renders and the
schema does not constrain. Recorded in the `Department` dossier rather than
silenced.
| Gate D — cross-cutting | 0e 0w 1i | nothing | **0 errors, 0 warnings, 1 note** — five sagas, four rules, three handlers, one new relationship and two state-machine edges. Scorer 20/20; `saga-check.mjs` 7/7 |
| Phase 6 — generate, verify, repair | 0e 0w 1i | nothing | **0 errors, 0 warnings, 1 note** — 16 actions rewired after the generated application contradicted an assumption; 6 new columns, 10 new handlers, 3 rule sections removed. Scorer 20/20; saga-check 7/7; seeded-condition check 25/25 on-row |
