# M7.5 — Weave review and named tracks

S9 displays each route-text snapshot beside its permitted claims and goal. Reviewer-only actions
approve a ready item, edit it (which clears approval), or ask for one bounded rewrite. Each
action records actor, version, note and the text reviewed. Flagged prose needs a note to approve.
All actions lock the bundle and check the item's expected version and current graph signature.
Stale bundles are read-only and can be replaced by a fresh generation for current inputs.

Publishing requires a current full route (no known-node pruning), every expected text present
and approved, and a nonempty name. The sorted goal set uniquely identifies a named track, so
different goal wording resolving to the same targets shares one catalogue entry. Publication
references the reviewed bundle and actor. Every catalogue read recomputes eligibility; changed
claims/adjacencies or edits remove that version from public discovery until reviewed again.

S9 uses the existing route map and per-item list/progress, with text adjacent to its allowed
claims, flags and notes. J/K moves the selected item outside form fields. The public catalogue
links to the deterministic route with canonical goals; it does not write routes or node bodies.
Introduction/bridge/why text remains plain text with explicit review status. Generation failures
leave manual editing available; no model is required to write connecting text for human review.
