# M7.6 — Skeletons

S18 accepts a pasted public/open course outline from the sources named in T5.3: College Board,
OpenStax, Galaxy Training or Carpentries. Record source URL, version, licence and the author's
confirmation that the supplied outline may be used. The server fetches no URLs. Khan Academy
is not an import source. A bounded import contains at most 16,000 characters.

One background job proposes at most 20 stubs with title, claim, registered region, level and at
most four reasoned needs each. References distinguish local stubs from existing indexed nodes.
The server rejects unknown targets, duplicate IDs and cycles. Graph context is an allowlist of
indexed candidates; stubs and proposals never become graph records or tracks automatically.

A fresh judge call scores each stub and link, recording a versioned rubric, score and reason.
One redraft is allowed when a score is below 4 out of 5, then one final judge call: at most four calls.
Refused judging leaves explicit unscored items. The last valid proposal remains inspectable if
redrafting fails. Import and scoring use the normal gateway caps and timeouts.

Authors map each stub to new/existing/merge. Existing/merge targets must exist in the current
index. Sending selected stubs to Requests is a human action with a review note; it creates only
requested items, preserving source, proposed fields, needs, scores and mapping as proposal
metadata. Every new prerequisite must also be selected or already mapped to an existing node.
Repeated sends cannot create duplicates. Nothing is accepted, drafted, approved or published by
the import worker. S7 is still the human gate into Implementing.

S18 follows the Skeletons board: source/import form, scored proposed stubs/links, explicit mapping
and send controls. Failure and unscored states remain visible. Source excerpts stay in private
Studio records and never enter AICall; only metadata/call IDs are stored there.
