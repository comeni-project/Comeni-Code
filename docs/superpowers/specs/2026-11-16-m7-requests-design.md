# M7.2 — Requests intake and S7

Against W3.6 and the Requests board. Unknown learner goals can be submitted explicitly as
requests, with a title and description, without an account. No request is sent merely by typing
or searching. Intake is bounded and throttled; a caller-generated UUID makes retries idempotent.
Exact normalized titles share a queue row while each submission has a separate opaque receipt.
The receipt exposes only that request's public disposition, not internal notes or other askers.

S7 provides a dense queue table, state/search filters, counts and a selected detail panel with
the request and decision history. Authors can record accept, merge, decline, snooze and resume
decisions. Bulk triage is atomic and version checked: one stale request refuses the entire batch.
Reasons stay visible to staff; decline reasons also reach the learner's receipt. M7.1's service
remains the only decision path. No action publishes content.

Queue records are grouped only by exact normalized title initially; model grouping suggestions
are advisory and may fail without changing intake or decisions. No anonymous identity is stored
in gateway logs. S7's visual structure follows `.design/Requests.dc.html`; light/dark colors use
the existing app tokens. Empty, loading, error and conflict states are explicit.

The HTTP adapter bounds page sizes, title/description lengths and bulk size. Anonymous intake
uses a per-client cache limit and a site-wide limit, without retaining raw addresses. Receipt
IDs are random UUIDs, distinct from staff request IDs. They reveal no transcript or staff actor.
