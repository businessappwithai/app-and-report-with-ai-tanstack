# hospital-management-system — progress

Phase: **6 complete — verified against a generated application** · next: delivery · Updated: 2026-09-06

Protocol: `llmdetailed.txt` §10, read from https://appwithai.org/llmdetailed.txt

| Gate | State |
|---|---|
| A research    | approved |
| B roster      | approved — 30 entities |
| C entities    | **30 of 30 — closed.** Every entity walked, dossiered and approved |
| D cross-cut   | **closed** — 5 sagas, 2 handlers, 1 missing relationship and 2 missing edges. See `04-cross-cutting.md` |
| E validation  | **closed** — see `05-phase6-findings.md`. The generated app contradicted the derived-context assumption; the model was repaired and re-verified |

## Gate A answers

| Fork | Answer |
|---|---|
| Who pays | Insurer, with policies and co-pay |
| Scope | Core only — no referrals, no emergency department |
| Ward transfer | One admission, the bed changes |
| Consent | A record per procedure |

## Open questions for the user

- **`role:admin` mints a second administrator.** Found while walking `Ward`.
  `deriveAccess` skips a declared role whose title-cased name collides with a
  built-in — and "Admin" does not collide with "Administrator", so writing
  `role:admin` seeds an *ordinary* role called Admin alongside the real one.
  In the published hospital model this is live: **`Admin` reads 5 of 28 entities
  while `Administrator` reads all 28**, so anyone signing in as the declared
  admin account sees five screens. `role:administrator` collapses into the
  built-in correctly. **Decided at Gate C (Ward): use `role:administrator`.**
  Applied retrospectively to Department and Ward; the spurious role is gone.

- ~~Does the delivered model **replace** the published~~ **Answered at Gate A:
  replaces it.** Original text: does it replace the published
  `guide/models/hospital-management-system.eml.mmd` (and its upstream twin), or
  stand beside it as a second hospital model? This decides the `%%meta name:`
  and whether the byte-parity rule between `html/models/` and `language/examples/`
  applies to the result.

## Notes on the protocol itself

Collected as I go, for the `llmdetailed.txt` revision the user asked for.

1. **§10.0 says "one question at a time"; the surface allows four.** Taken
   literally, a five-fork Gate A becomes five round trips. The rule's *reason* is
   that each answer should inform the next question — which is true for dependent
   questions and false for independent ones. Needs restating as a test, not a
   count.
2. **The session directory is named `docs/eml-sessions/` with no root given.**
   Fine in a single workspace; ambiguous where there is more than one repository,
   or none.
3. **Gate A has no defined artefact for "approved".** The protocol says do not
   proceed until the user approves the document, but nothing says what the model
   should *show* them to get that approval. A 200-line research document is not
   a reviewable object; a summary of what changed and what is still assumed is.
4. **A long edge's label lands on an unrelated node.** Seen on the Bed
   occupancy machine: `closed --> available` spans the whole row, and the
   viewer puts its label at the curve's midpoint, which is on top of two
   boxes it has nothing to do with. A cyclic machine also ranks into a
   straight line, so it reads as a chain. Viewer improvement, not a model
   problem — noted, not chased mid-walkthrough.
5. **A `_by` suffix on a column that is not a reference is a trap the protocol
   does not warn about.** `Consent.given_by` held an enum and earned `EML119`;
   §3.7 states the convention but §10.4's per-entity checklist never asks the
   question, so the model writes the natural English name and finds out at the
   validation step. Worth a line in the field-naming guidance.
6. **Nothing tells the model what to do when the brief is one line.** Almost
   every statement here is `[inferred]` or `[assumed]`, which is the normal case
   for "build me an app for X" — the protocol should say that the tag histogram
   itself is a signal worth showing at the gate.

## Viewer observations

- A long edge's label lands on an unrelated node (recorded above at Bed).
- **Filtering the ERD does not refit the canvas.** `fit()` measures
  `contentSize`, which is the whole diagram, so typing `encounter` correctly
  isolates the six matching boxes and then leaves them at the zoom the whole
  30-entity model needed — legible only after zooming in by hand. Fitting to the
  matches is what the filter is for.

## Carried into Gate D

Recorded as each entity was walked, to be built as one group rather than
piecemeal:

| Effect | From → to |
|---|---|
| Appointment check-in creates the encounter | `Appointment` → `Encounter` |
| Admission takes the bed | `Admission` → `Bed.occupied` |
| Discharge releases the bed for cleaning | `Admission` → `Bed.cleaning` |
| Closing an encounter raises the invoice | `Encounter` → `Invoice` |
| Completing a procedure raises the charge | `Procedure` → `InvoiceLine` |
| Withdrawing consent stops a consented procedure | `Consent` → `Procedure` |
| Dispensing decrements the stock | `Prescription` → `StockTransaction` |

And three things to verify rather than assume:

1. **The derived rule context.** Seventeen rules read values that are not columns
   of the row being written — `bedStatus`, `consentCount`, `hasControlledItem`,
   `activeSameClassCount`, `outstandingAmount`, `quantityOnHand` and the rest.
   Checked against a generated application at Phase 6, not before.
2. **The four arithmetic handlers** — `applyPolicyCoPay`, the `paid_amount`
   running total, `applyStockMovement`, and the invoice `gross_amount` — are
   hooks because neither a `transform` action nor a `Formula` step can compute
   from another row. Confirm the generator scaffolds all four.
3. **Every saga writes a status the state machine draws an edge to.** Verified by
   hand for the two payment sagas; do it for all five.
