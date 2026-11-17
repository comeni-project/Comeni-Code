# M7.3 — Implementing

S8 shows accepted requests and their linked drafts, with assignment, stage, activity and team
load. An author explicitly starts writing by opening a new draft through the existing content
API service. A requested/declined/merged item cannot start writing. Creating a draft is idempotent
for the request and records the actor and resulting request version transactionally.

Assignment accepts only current active authors and higher roles. Bulk assignment is atomic and
version checked. A request's draft is the existing Studio Draft, never a second content store.
The stage follows that draft: open → writing, submitted → waiting for review, approved → approved,
landed → live; discarded is shown explicitly. Reads never invent approval or landing events.
Stalled means no request change or draft revision for 14 days. Team load counts writing and
reviewing work without deadlines. Route-impact ordering will consume actual tracked requests
when M7.5 persists route candidates; no user-entered popularity scores are trusted.

The screen follows `.design/Implementing.dc.html`: views for all/unassigned/mine/waiting/stalled,
collapsible stage groups, bulk assignment and workload. Workbench remains the editor and Review
remains the sole approval path. All mutations check the current actor and expected version.
