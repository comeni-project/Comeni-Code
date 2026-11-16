# M7.1 — Request records and the human gate

Requests persist independently of the current content index. This first backend slice provides
one service for intake and decisions, before S7 and public learner intake arrive in M7.2.

A request has a public UUID, title, description, creator, state and monotonically increasing
version. Intake always starts at requested, including model proposals. Authors and higher roles
may triage. Each decision records the actor, action, reason, previous/next state and resulting
version in the same transaction. Concurrent decisions use a row lock and an expected version;
a stale decision changes nothing.

Requested or snoozed requests may be accepted, declined with a reason, merged into an existing
indexed node with a reason, or snoozed with a reason and a future time. A snoozed request can be
returned to requested by a person. Accepted, declined and merged requests cannot be decided
again in this slice. Time passing does not silently move a request into Implementing.

No model can make a decision: the service checks an active author account even when called
outside HTTP. Accepting creates no draft, content, graph change or publication; M7.3 owns the
explicit handoff to Implementing. Missing merge targets are refused rather than invented.

This part adds no learner endpoint or screen. M7.2 owns HTTP diagnostics, anonymous intake
bounds, duplicate grouping and S7. This avoids exposing intake before its limits and disclosure
are specified. Anonymous request creation is supported internally for that later adapter.

Tests cover intake, role gates, required decision data, stale decisions, future snooze times,
terminal states and the audit trail. Integration with real GitHub is deferred by operator order.
